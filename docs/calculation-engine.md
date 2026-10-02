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
| `category` | string | One of the four trade keys in [`WORK_CATEGORIES`](../carpaintr-front/src/calc/workCategories.js): `arm` (арматурні), `body` (рихтувальні), `paint` (малярні), `extra` (додаткові). An unrecognised or missing value (e.g. the legacy `"General"`) is normalized to `uncategorized` and sorts last. Author it through the **Category** picker in [ProcessGenerator.jsx](../carpaintr-front/src/components/editor/ProcessGenerator.jsx) — this field used to be free text, which is why older processors say `"General"`. |
| `orderingNum` | number | Sort order. Applied once, right after the processors bundle is fetched and verified, in [CarBodyMain.jsx](../carpaintr-front/src/components/calc/CarBodyMain.jsx) (`.sort((a, b) => a.orderingNum - b.orderingNum)`). Every downstream consumer — the evaluation results table, the by-part and by-category grouped views, the print payload, and the Excel export — relies on this order already being applied; none of them re-sort. |

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
x.mkRow({ name, evaluate, tooltip, unit })
```

`mkRow` creates a normalised row object. The `evaluate` field is a **string expression** (e.g. `"tableData['Labour']['REPAIR_LIGHT']"`) that will be `eval()`-ed by the engine to produce a numeric estimate.

Set `unit` (e.g. `"л"`, `"мл"`) on rows that represent **materials** rather than labour — a non-empty `unit` is what [`isMaterialRow`](../carpaintr-front/src/calc/collapseTables.js) uses to push the row after all labour rows in both grouped views and the Excel export. Every consumer also receives `category` and `orderingNum`, stamped from the owning processor by `evaluate_processor()` — authors don't set these on individual rows.

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
  category: "arm",
  orderingNum: 100,
}
```

---

## Editable calculation document (Calc2)

`CalcMain` owns a version-2 document and bounded undo history above all wizard
stages. Components dispatch functional patches; table rendering has no state
writes. Every cell editor commits valid input immediately and stores incomplete
numeric text in `cellDrafts`. Stage tabs, Back/Accept and browser history therefore
use the same cells. Invalid active drafts block document generation; saving still
preserves drafts for recovery.

The authoritative data consists of inputs, `generatedCalculations` (processor
defaults), `cellOverrides[entityId][field] = {kind: "literal", value}`, lookup
`inputOverrides`, saved rates/currency and source snapshots. `resolveDocument()`
produces `calculations`, `totalTables`, `categoryTables`, `grandTotal` and
`computedGrandTotal`. These resolved values supply screen views and outputs.

### Processing and identities

`processorContext.js` passes the actual year/model, paint, paint type, quality,
damage, saved pricing defaults, lookup values and required files. `processPart()`
isolates each processor's context, validates requirements and collects tables,
logs and errors. Numeric expressions accept complete decimal-comma literals;
other JavaScript expressions run unchanged. Nonfinite results are rejected.

The input fingerprint includes all context values and processor versions. A
saved snapshot displays immediately; reopening does not replace it with current
catalog values. The parts stage saves processor code, required files, lookup
values and pricing preferences. Explicit **Refresh calculation defaults** adopts
current source defaults and reconciles entities. Failed processors retain their
last successful tables; errors remain visible. Request epochs reject older
vehicle/refresh responses.

The backend assigns processor identity from its catalog filename and a separate
content hash version. Generator row clauses and all bundled processors emit persistent `key` fields.
Legacy rows use source trace or original description keys. Table/row IDs are
persisted and never follow edited labels or ordering. Unique matches recover
previous IDs; ambiguous duplicate matches retain edited rows in an inactive
archive for explicit restoration instead of transferring their edits.

Removing a part archives its generated rows and input settings, excluding them
from active totals and outputs. Reselecting/restoring the same catalog part
restores its edits. Parts are unique by catalog name in the current selector;
multiple independent instances of the same catalog part are not exposed.

### Editing, pricing and totals

Detailed, collapsed and category views address the same row IDs. Name,
estimation, unit, price, sum, category, ordering, tooltip and inclusion are
editable. Part labels, table names, table/part/category totals and grand total
have separate addressed overrides. Calculation-specific lookup edits run before
processors and never change shared CSV files.

A literal price wins over processor defaults and labor rates. Otherwise explicit
processor prices remain, labor uses table → part → base rate, and materials
remain unpriced unless a material price exists. Editing a displayed unit does
not change the row's original material/labor classification. Numeric zero and
blank (`null`) are explicit edits; **Reset to default** removes the override.
**Reset all edited cells** removes output-cell edits and drafts; lookup edits
and rates have their own controls. Undo includes user edits and removals while
excluding processing/cache/view/save metadata changes.

Without a sum override, decimal coefficient arithmetic multiplies quantity and
price and rounds to two currency places, half away from zero. Totals add the
same effective amounts. A manual sum remains literal. Table totals feed part
totals; part totals feed the grand total. Category totals independently group
row amounts. Manual aggregates can disagree; computed values remain available
and built-in exports show differences without inventing balancing rows.

### Save/load and outputs

Local recovery and server loading use the same idempotent migration. Ambiguous
legacy fields and unknown sums/totals are preserved as literals; known managed
norm prices keep rate linkage. Opening a file never writes it to the server.

A single save coordinator above stages serializes saves. Acknowledgments patch
only the filename and saved revision; edits made while saving remain current.
An owner epoch rejects acknowledgments after another calculation is loaded.
The Rust storage endpoint preserves additive V2 fields through serde flattening.

Print payloads include `calculation.calc`, `calc_by_category`, stable category
keys with `category_labels`, `part_totals`, `part_labels`, `grand_total` and the
saved `currency`. Rows preserve IDs, descriptions, categories, units, literal
prices/sums, ordering and notes. Explicit exclusion removes a row; zero/blank
values do not remove it. Built-in templates use saved currency with a legacy
company fallback. Custom templates can read these additive fields.

Excel uses the same resolved snapshot, with category subtotals and grand total,
plus a part-total sheet. Its columns are Category, Part, Work/Material,
Norm-hours, Unit, Price, Sum, Tooltip and Ordering. Order number/date and document
notes belong to the saved calculation.

Regression coverage lives in `calculationDocument.test.js`,
`calculationPersistence.test.js`, `processingPipeline.test.js`, output/workbook
tests, `test_calculation_document.py`, actual Jinja rendering tests and
`calculation-document.cy.js` (desktop/mobile + delayed save).

---

## Creating Processors — The Processor Generator

Processors are authored via the **Create Processor** page (`/app/create-proc` → [CreateProcPage.jsx](../carpaintr-front/src/components/pages/CreateProcPage.jsx)), which renders the [ProcessorGenerator](../carpaintr-front/src/components/editor/ProcessGenerator.jsx) component.

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
| Required Files | `requiredFiles` | Loaded and snapshotted before processing |
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
        output.push(mkRow({key: "stable-clause-key", name: "…", evaluate: tableData["T"]["field"], tooltip: "…"}));
        if (repairAction == "paint_one_side") {
            output.push(mkRow({key: "stable-clause-key", name: "…", evaluate: tableData["T"]["field2"], tooltip: "…"}));
        }
        return output;
    },
    requiredTables: ["T"],
    requiredRepairTypes: ["paint_one_side"],
    requiredFiles: [],
    category: "paint",
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

```text
CalcMain document/reducer
  → saved inputs + source snapshots + lookup overrides
  → processorContext → processPart → stable entity reconciliation
  → resolveDocument (cell overrides, rate precedence, decimal amounts, totals)
  → detailed / collapsed / category views
  → local draft + API save snapshot + HTML/PDF payload + Excel
```

See [the refactoring plan](calc2-refactoring-plan.md) for the edit contract and
acceptance scenarios.
