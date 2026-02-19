# Calculation Engine — Business Logic

This document describes the most important business logic in the application: how repair cost estimates are calculated for each car part.

---

## Overview

When a user selects a damaged car part and assigns a repair action (e.g., `paint`, `repair`, `replace`), the system:

1. Fetches **lookup tables** for that part from the backend (prices, labour norms).
2. Loads a **processors bundle** — a JavaScript module containing one processor per repair rule.
3. Filters processors by which ones apply to this part and action.
4. **Evaluates** each matching processor to produce a list of work rows (labour hours, coefficients, etc.).
5. Renders the rows in an editable **EvaluationResultsTable**, where service company operators can override any individual value.
6. **Re-evaluates** automatically when the selected action changes.

---

## Data Sources

### 1. Processors Bundle (`/api/v1/user/processors_bundle`)

A single JavaScript file that sets `exports.default` to an array of processor objects. It is fetched once per car class/body type combination and compiled in a sandbox via:

```js
const sandbox = { exports: {}, ...make_sandbox_extensions() };
new Function("exports", code)(sandbox.exports);
const processors = sandbox.exports.default.map(p => verify_processor(p));
```

`verify_processor` merges each processor with `defaultProcessor` to fill in any missing optional fields.

### 2. Part Lookup Tables (`/api/v1/user/lookup_all_tables?car_class=…&car_type=…&part=…`)

Returns `[[filename, tableData], …]` — one entry per CSV/YAML table file relevant to this part. Preprocessed into:

```js
{ name: stripExt(filename), data: tableData, file: filename }
```

Stored in `tableDataRepository[partName]`. This repository persists until the car class or body type changes, so repeated opening of the same part does not re-fetch.

### 3. Company Pricing Preferences

Loaded once from `getOrFetchCompanyInfo()`. The relevant fields used in evaluation:

```js
company.pricing_preferences.norm_price.amount   // base labour rate (e.g. 600 UAH/hr)
company.pricing_preferences.norm_price.currency  // currency label (e.g. "UAH")
```

---

## Processor Format

Each processor in the bundle is an object with these fields:

| Field | Type | Purpose |
|---|---|---|
| `name` | string | Display name shown in the results table header |
| `shouldRun` | function | Returns `true` if this processor applies to the current context |
| `run` | function | Produces the array of work rows |
| `requiredTables` | string[] | Table names that must exist in `tableData` for this processor to run |
| `requiredRepairTypes` | string[] | Repair action strings this processor is valid for (e.g. `["paint", "toning"]`) |
| `requiredFiles` | string[] | (Currently unused) |
| `category` | string | Grouping label |
| `orderingNum` | number | Sort order when multiple processors match |

### The `stuff` Context Object

Both `shouldRun` and `run` receive `(x, carPart, tableData, repairAction, files, carClass, carBodyType, carYear, carModel, paint, pricing)`. These are sourced from `stuff`:

```js
const stuff = {
    repairAction: action,        // the selected action string, e.g. "paint"
    files: [],
    carClass,                    // e.g. "B"
    carBodyType: body,           // e.g. "sedan"
    carYear: 1999,               // placeholder — not yet configurable
    carModel: {},
    tableData: tdata,            // { tableName: tableRows, … } flat map
    paint: {},                   // placeholder — paint data not yet wired
    pricing: company.pricing_preferences,
    carPart: item,               // the full selectedItem object (name, action, grid, …)
};
```

### The `x` Sandbox Object

The first argument to `shouldRun`/`run` is a sandbox helper object. Currently it exposes:

```js
x.mkRow({ name, evaluate, tooltip })
```

`mkRow` creates a normalised row object. The `evaluate` field is a **string expression** (e.g. `"tableData['Labour']['REPAIR_LIGHT']"`) that will be `eval()`-ed by the engine to produce a numeric estimate.

### Example Processor

```js
{
  name: "LABOUR — DISASSEMBLY/ASSEMBLY FOR REPAIR",
  shouldRun: (x, carPart, tableData, repairAction) => true,
  run: (x, carPart, tableData, repairAction) => {
    const { mkRow } = x;
    return [
      mkRow({ name: "Remove part for repair",   evaluate: tableData["Labour"]["REMOVE_FOR_REPAIR"],   tooltip: "…" }),
      mkRow({ name: "Reinstall part after repair", evaluate: tableData["Labour"]["REINSTALL_FOR_REPAIR"], tooltip: "…" }),
    ];
  },
  requiredTables: ["Labour"],
  requiredRepairTypes: ["toning", "paint_one_side", "paint_two_sides"],
  category: "General",
  orderingNum: 100,
}
```

---

## Evaluation Pipeline

Implemented in [processor_evaluator.js](../carpaintr-front/src/calc/processor_evaluator.js) and called from [CarBodyMain.jsx](../carpaintr-front/src/components/calc/CarBodyMain.jsx).

```
For each selected part:
  │
  ├─ [tableDataRepository] loaded? ──No──▶ fetch from API, wait for next render cycle
  │
  ├─ action selected? ──No──▶ show "Select an action to calculate" hint
  │
  └─ For each processor:
       │
       ├─ validate_requirements(proc, tdata)  ── missing table? ──▶ skip
       │
       ├─ is_supported_repair_type(proc, action) ──▶ skip if action not in proc.requiredRepairTypes
       │
       ├─ should_evaluate_processor(proc, stuff) ──▶ calls proc.shouldRun(); skip if false
       │
       └─ evaluate_processor(proc, stuff)
            │
            ├─ calls proc.run() → array of { name, evaluate, tooltip }
            │
            ├─ for each row where evaluate is non-empty:
            │     estimation = eval(evaluate.replace(",", "."))
            │
            └─ returns { name, result: [{name, estimation, tooltip, …}], error }
```

### `eval()` and Why It Is Intentional

The `evaluate` field in each row is a JavaScript expression string authored by the admin in the processor script. It is evaluated with `eval()` so processors can express arbitrary formulae referencing the lookup table values:

```js
eval(item.evaluate.replace(",", "."))
```

The comma→period replacement handles European decimal notation in source data.

---

## Re-evaluation Logic

Re-evaluation is guarded by `lastEvaluatedRef` — a ref tracking `{ partName → lastAction }`:

- **Trigger:** `selectedItems`, `processors`, `company`, or `tableDataRepository` changes.
- **Guard:** if `lastEvaluatedRef.current[partName] === currentAction`, skip — prevents overwriting manual overrides when an unrelated state change fires the effect.
- **Reset:** when the action changes (e.g. user switches from `paint` to `repair` in the drawer), the stored action differs from the new one, so the part is re-evaluated fresh.
- **Car change:** when `carClass` or `body` changes, `lastEvaluatedRef`, `tableDataRepository`, and `fetchingPartsRef` are all cleared so everything re-fetches from scratch.

---

## Result Format

`evaluate_processor` returns:

```js
{
  name: "Processor display name",   // shown as table section header
  result: [
    {
      name: "Work item name",        // substituted via applyRedefinitions (e.g. «Деталь» → actual part name)
      estimation: 1.5,               // eval() result — labour hours or coefficient
      tooltip: "source field name",  // shown on hover
      price: undefined,              // filled by EvaluationResultsTable.updateSums()
      sum: undefined,                // filled by EvaluationResultsTable.updateSums()
    },
    …
  ],
  text: "…",    // raw serialised form, used for error display
  error: null,
}
```

The `calculations` object shape in the parent state:

```js
{
  "Hood": [ processorResult1, processorResult2, … ],
  "Front Bumper": [ … ],
}
```

---

## Manual Overrides (EvaluationResultsTable)

[EvaluationResultsTable.jsx](../carpaintr-front/src/components/calc/EvaluationResultsTable.jsx) renders each processor result as an interactive table. Every cell in the `Estimation` and `Price` columns is wrapped in `InlineEditWrapper` — the operator can click any cell and type a new value.

- Changing `estimation` → `sum` updates in real time.
- Changing `price` → `sum` updates in real time.
- `Total` row shows the sum across all rows for that processor.
- `setData` propagates changes upward via `setCalculations(prev => ({ ...prev, [partName]: newData }))`.

### Override Persistence

**Overrides survive across:**
- Unrelated state changes (scrolling, adding other parts, diagram interactions)
- Stage navigation (returning to the Body Parts stage preserves edits)
- Component remounts

**Mechanism:** The `lastEvaluatedRef` tracks `{ partName → action }` pairs. Re-evaluation only fires when the `(part, action)` pair changes. Additionally, when `CarBodyMain` mounts with pre-existing `calculations` in props, it seeds `lastEvaluatedRef` to mark those parts as already-evaluated, preventing re-evaluation and preserving operator overrides across stage transitions.

**Overrides are cleared when:**
- The repair action for a part changes in the part drawer (user saves → re-evaluation from scratch)
- Car class or body type changes (entire component resets)
- User explicitly navigates backward to an earlier stage and then forward again (fresh calculation)

This design prioritizes respecting operator judgement: once a calculation is edited, it stays edited unless the part's action explicitly changes or the car selection changes.

---

## Creating Processors — The Processor Generator

Processors are authored via the **Create Processor** page (`/create-proc` → [CreateProcPage.jsx](../carpaintr-front/src/components/pages/CreateProcPage.jsx)), which renders the [ProcessorGenerator](../carpaintr-front/src/components/editor/ProcessGenerator.jsx) component.

This is the primary tool for admins and editors to add new calculation rules without touching raw JavaScript files.

### Two-Stage Workflow

```
Stage 1: Form  →  "Generate Code"  →  Stage 2: Code Review  →  "Upload to Server"
```

**Stage 1 — Form** fills out all processor fields through a structured UI:

| Form Field | Processor Field | Notes |
|---|---|---|
| Processor Name | `name` + filename | Spaces → underscores for the filename |
| Category | `category` | Free text grouping label |
| Ordering Number | `orderingNum` | Controls sort order when multiple processors match |
| Required Repair Types | `requiredRepairTypes` | Tag picker populated from `/api/v1/user/list_all_repair_types` |
| Required Tables | `requiredTables` | Autocompleted from `/api/v1/editor/all_tables_headers` |
| Required Files | `requiredFiles` | (Currently unused) |
| Condition | `shouldRun` body | Optional JS block; defaults to `return true;` |
| Row Clause Section | `run` body rows | One editor panel per output row (see below) |

**Row Clause Editor** (`ClauseListEditor`) — each clause maps to one `output.push(mkRow(…))` call:

| Clause Field | Generated Code |
|---|---|
| Name | `name: "…"` string in the mkRow call |
| Evaluate | `evaluate: <expr>` — JS expression referencing `tableData[…][…]` |
| Tooltip | `tooltip: "…"` |
| Condition | Wraps the push in `if (<condition>) { … }` |

The **Evaluate** field has a `TreePicker` populated from the table headers API. It lets authors browse `tableData["TableName"]["FieldName"]` paths and click to insert them — avoiding typos in the most error-prone part of processor authoring.

**Stage 2 — Code Review** renders the generated JS in an editable textarea. The author can make last-minute manual changes before upload. The generated code matches the processor format exactly:

```js
({
    name: "…",
    shouldRun: (x, carPart, tableData, repairAction, files, carClass, carBodyType, carYear, carModel, paint, pricing) => {
        return true;
    },
    run: (x, carPart, tableData, repairAction, files, carClass, carBodyType, carYear, carModel, paint, pricing) => {
        var output = [];
        const { mkRow } = x;
        output.push(mkRow({name: "…", evaluate: tableData["T"]["field"], tooltip: "…"}));
        if (repairAction == "paint_one_side") {
            output.push(mkRow({name: "…", evaluate: tableData["T"]["field2"], tooltip: "…"}));
        }
        return output;
    },
    requiredTables: ["T"],
    requiredRepairTypes: ["paint_one_side"],
    requiredFiles: [],
    category: "General",
    orderingNum: 100
})
```

### Upload

Clicking **Upload to Server** POSTs the JS file to:

```
POST /api/v1/editor/upload_user_file/procs/<sanitizedName>.js
```

The file is stored on the server under the `procs/` directory. The processors bundle endpoint (`/api/v1/user/processors_bundle`) compiles all files under `procs/` into the single bundle that the frontend evaluates.

### Catalog Sidebar

The **Catalog** button (magnifier icon) opens a `PartsCatalog` component alongside the form (desktop: inline sidebar; mobile: bottom drawer). This lets the author browse the full list of available parts and table fields without leaving the generator, so they can reference correct table/field names while writing clauses.

---

## Data Flow Summary

```
BodyPartsStage
  │  props: carClass, body, calculations, setCalculations
  │
  └─ CarBodyMain
       │
       ├─ fetches: processors_bundle, carparts, carparts_t2
       ├─ fetches: lookup_all_tables (per part, on demand)
       │
       ├─ on (selectedItems | processors | company | tableDataRepository) change:
       │     → evaluate processors → setCalculations(prev => { ...prev, [part]: results })
       │
       └─ renders:
            ├─ CarDiagram  (select/deselect parts)
            ├─ Selected Parts table  (click row → open drawer)
            ├─ Part Details Drawer  (set action, damage level, replace flag)
            └─ Calculations section
                 └─ per-part EvaluationResultsTable  (editable by operator)

BodyPartsStage.handleClose()
  └─ setStageData({ parts: { selectedParts, calculations, … } })
       └─ TableFinalStage renders EvaluationResultsTable for all parts (final review + print)
```
