# Calc2 pipeline refactoring plan

Status: implemented. See [the calculation document contract](calculation-engine.md) and the regression suites for current behavior. Module boundaries were consolidated into `calculationDocument.js`, `calculationPersistence.js`, `processorContext.js` and `processingPipeline.js`; existing output adapters remain compatible.

## Required behavior

A calculation is an editable document. Processor output supplies defaults;
the user's cell edits belong to the document and remain authoritative until
the user explicitly resets them.

Edits must survive stage navigation, component remounts, view changes,
processor reruns, changes to vehicle/paint/damage/rates, local draft recovery,
server save/load, and HTML/PDF/Excel generation.

This plan assumes “any cell” includes descriptions, displayed part/table names,
category, unit, ordering, estimation, price, row sum, and subtotal/grand-total
cells. Identity fields stay internal. Editing a displayed part name changes
its label; moving a row to another part is a separate, explicit reassignment.
If lookup-table editing is exposed inside calc2, those edits are saved as
calculation-specific input overrides, without changing the shared catalog.

## 1. Establish the edit contract

| Operation | Required result |
|---|---|
| Edit a cell | Commit an override for that exact entity and field. |
| Edit a name, category, unit, or sort order | Keep the same entity ID and all its edits. |
| Change estimation or price | Recalculate the row sum only when the sum has no override. |
| Override a row sum | Preserve that amount even when estimation, price, or rates change. |
| Reset one cell | Remove only that cell's override and reveal its current default. |
| Enter zero or an empty value | Preserve the explicit value; never interpret it as reset. |
| Change an upstream input | Regenerate defaults and reapply compatible edits. |
| Switch stage or table view | Display the same effective cells without rerunning processors. |
| Remove a part | Exclude its rows from every total/output; retain edits in an inactive archive for restoration. |
| Change action so a row disappears | Retain its edits as inactive; do not attach them to a different row or include them in totals. |
| Reopen a saved calculation | Restore its snapshot immediately, without fetching current defaults to replace it. |
| Processor/fetch failure | Keep the last successful snapshot and edits; expose the failure. |

Track override presence with an explicit key/tag, never truthiness or nullish
fallback. Numeric fields distinguish a deliberate blank from an invalid
draft; invalid drafts stay editable and cannot silently become zero.

### Sums and totals

Manual row sums override estimation × price. Totals normally add effective
row amounts. An editable subtotal or grand total needs its own saved literal
override; it must not back-solve quantities or prices.

Recommended behavior for aggregate overrides: expose the computed amount,
the edited amount, and their difference. Preserve and print the edited total
for its scope. Grand total uses an explicit grand-total override when present;
otherwise it sums effective part totals. Within a part, table overrides feed
the computed part total. Category totals group effective row amounts and
carry any explicit category-total overrides separately.

Part and category subtotals overlap, so arbitrary manual targets can disagree.
Keep both edits and visibly identify the discrepancy; never silently alter an
earlier edit or invent balancing rows. This policy deliberately permits
operator-authored totals. If totals must always reconcile, replace this policy
with explicit adjustment rows and conflict resolution before implementing
aggregate editing. Row-cell persistence does not depend on that decision.

Use one decimal parsing and rounding policy. Normalize decimal commas at
numeric input boundaries, not by rewriting JavaScript expressions. Reject
NaN/Infinity. Use decimal arithmetic for money and round row amounts once to
the calculation's currency precision; all consumers use those same amounts.
Explicit inclusion/exclusion controls whether a row appears in outputs;
zero or blank cells must not automatically erase user-authored rows.

## 2. Introduce a versioned document model and stable identities

Persist a `schemaVersion: 2` document with these sections:

| Section | Contents |
|---|---|
| Inputs | Vehicle, paint, quality, selected parts/actions/damage, order fields. |
| Source snapshot | Lookup values and processor versions used for the last successful run. |
| Generated entities | Parts, processor tables, and rows with stable IDs and default field values. |
| Input overrides | Calculation-specific lookup-cell changes applied before processing. |
| Cell overrides | Per-entity, per-field literals, including explicit blank/zero values. |
| Pricing | Currency, base/additional rate snapshot, and part/table rate selections by ID. |
| Lifecycle | Active/inactive entities, unresolved matches, processing errors, and last processed input revision. |
| Persistence metadata | Calculation/file ID, current revision, and last saved revision. |

For example, a manual price must not lock the description or estimation:

```json
{
  "cellOverrides": {
    "row:hood:paint:coat-1": {
      "name": { "kind": "literal", "value": "Custom painting description" },
      "price": { "kind": "literal", "value": "250.00" },
      "sum": { "kind": "literal", "value": "475.00" }
    }
  }
}
```

Provide immutable part instance IDs, processor IDs, table IDs, and processor
row keys. IDs must not depend on translated names, edited names, ordering,
expression values, or array indexes. Processor versions are tracked separately
from identity so formula changes do not detach compatible edits.

Update the processor generator to emit persistent processor IDs and explicit
row keys; migrate bundled processors. For legacy processors, use a persisted
identity adapter with an explicit match/unmatched result. Do not guess when
duplicate rows or conditional output make correspondence ambiguous. Preserve
unmatched edits and make them available to reattach, restore as manual rows,
or reset. A new part with the same name must not inherit another instance's
edits accidentally.

## 3. Extract a pure processing and resolution pipeline

```mermaid
flowchart LR
    A[Saved inputs and source snapshot] --> B[Apply lookup overrides]
    B --> C[Build real processor context]
    C --> D[Validate and execute processors]
    D --> E[Reconcile stable entities]
    E --> F[Resolve defaults, rates and cell overrides]
    F --> G[Group and resolve totals]
    G --> H[Screen, save snapshot, HTML/PDF and Excel]
```

Suggested modules under `carpaintr-front/src/calc/`:

- `calculationDocument.js`: schema, entity addressing, reducer actions.
- `processorContext.js`: real vehicle, paint, quality, damage, source values,
  required files, and calculation pricing; legacy processor argument adapter.
- `processingPipeline.js`: requirements, execution, normalization, diagnostics.
- `reconcileEntities.js`: generated identity matching and inactive edits.
- `resolveCalculation.js`: effective fields, amounts, subtotal overrides.
- `calculationSerialization.js`: version migration, snapshot save/load.
- `calculationOutputs.js`: adapters for existing print/template/Excel formats.

Resolve each field independently. For prices, a manual cell override wins;
otherwise keep an explicit processor price or resolve a labor rate through
table → part → base. Material prices come from material defaults or a manual
override; never from the labor rate. A manual sum wins over multiplication.

Preserve raw processor results and errors separately from effective cells.
Replace coarse `priceSource` decisions with field-level provenance. Keep the
existing expression contract through a compatibility adapter initially;
prefer numeric processor results for new processors. Do not add a blanket
comma replacement to formulas, where commas have JavaScript meaning.

Reprocessing depends on a complete input/source/processor revision, rather
than part name plus action. Rate-only changes can resolve prices without
rerunning processors unless a processor actually consumes that pricing input.
Freeze calculation defaults on creation/load; catalog or company updates are
adopted through an explicit refresh, followed by identity reconciliation.
Ignore late fetch/processing results for older revisions or removed parts.

## 4. Give the document one owner across stages

Keep the reducer/provider in `CalcMain`, above `StageView`. Stages and views
receive the same document and dispatch focused actions such as `EDIT_CELL`,
`RESET_CELL`, `SET_PART_INPUT`, `SET_RATE_SELECTION`, `REMOVE_PART`,
`APPLY_GENERATED_RESULTS`, and `SAVE_ACKNOWLEDGED`.

Remove the duplicated `parts.calculations`/`calculations` ownership and the
bidirectional `selectedParts`/`selectedItems` synchronization. Stage components
can own drawer visibility and temporary input text, but not independent copies
of committed calculation values. Defaults initialize missing inputs only;
asynchronous quality/company loads cannot replace saved selections.

Move totals/grouping to memoized selectors. Rendering a table must not call
`setData`, stamp prices, update sums, or write a draft. Move draft persistence
outside React state updater functions and serialize only committed revisions.

Every editor must commit before navigation, Save, Print, or Excel takes a
snapshot. Cover Accept/Back, stage tabs, browser history, Enter/blur, and touch.
Preserve incomplete draft text during remounts where practical; an invalid
numeric draft must remain visible for correction instead of exporting zero.

## 5. Make every table view edit the same entities

Refactor `EvaluationResultsTable` into a renderer using field descriptors and
`onEdit(entityId, field, value)`. Replace whole-table `cloneDeep` updates and
name-based `.find()` calls with focused reducer patches.

Detailed, collapsed, and category views keep source row IDs and expose the
same editable fields. Collapsing is a regrouping operation, not destructive
aggregation of distinct rows. Aggregate cells address their own scope IDs.
An edit in one view appears immediately in the others.

Show an unobtrusive edited indicator and a per-cell “Reset to default” action.
Provide undo for edits/removals and an explicit bulk reset. Labels, tooltips,
category, units and ordering receive the same persistence treatment as numeric
cells. Preserve source traces when a description is edited. Use RSuite/custom
components, localized labels, keyboard support and stable test IDs; test at
320px as well as desktop widths.

## 6. Use one snapshot for persistence and final outputs

Save both the editable model and its resolved snapshot with the same revision.
Loading renders the saved snapshot without running processors. Draft recovery
uses the same schema and migration path as server loading. Save acknowledgments
patch file ID/saved revision only; edits made while a request is pending remain
in current state. Serialize saves to the same file, or add revision checks so
out-of-order requests cannot overwrite a newer server snapshot.

The Rust `CarCalcData` currently preserves extra fields via serde flattening;
verify the complete V2 round trip through the actual API, including existing
`car.year` string and filename contracts. Make schema changes additive until
compatibility adapters are replaced.

Screen views, HTML/PDF, and Excel must consume `resolveCalculation()` output.
Remove downstream multiplication, rate fallbacks, zero-row filtering and sum
rewrites from `collapseTables.js`, `PrintCalculationDrawer`, `excelExport.js`,
and templates. Export effective names, categories, units, sums and totals;
include manual aggregate differences where relevant.

Carry calculation currency into print metadata and Excel headers. Current
templates read currency from live company preferences; switch them to the
saved calculation currency with a legacy fallback. Persist order number/date
and notes in the document instead of local final-stage/print-drawer state.

## 7. Migrate old calculations conservatively

Make migration deterministic and idempotent. Never modify old server files
merely by opening them; save the new format on the next explicit save.

- Preserve existing values, rates, labels, ordering and unknown metadata.
- Assign and persist entity IDs without collapsing duplicate names.
- Keep the original JSON/snapshot for recovery and migration tests.
- Existing `manual` fields stay overridden. Managed norm prices may keep rate
  linkage where it is known. For ambiguous legacy cells, preserve the saved
  value as a literal; do not infer edit intent from arithmetic equality.
- Preserve saved sum/total literals when their provenance is unknown. Provide
  a deliberate reset/adoption path instead of recalculating them on load.
- Map name-based rate selections to the correct IDs; retain ambiguous cases
  for review instead of applying them to several similarly named tables.
- Prefer top-level calculations for current-format files; consult
  `parts.calculations` only as a legacy fallback.
- Keep existing print payload shapes through output adapters while upgrading
  built-in templates. Document V2 fields for custom template authors.

## Delivery sequence

| Phase | Deliverable | Completion check |
|---|---|---|
| 1 | Permanent regressions for the reviewed failures and cell-edit contract. | Tests reproduce removed-part billing, remount overwrite, delayed-save rollback and output rewriting. |
| 2 | V2 model, IDs, migrations, pure resolver and output adapters. | Legacy fixtures and V2 save/load retain every edited field; resolver tests pass independently of React. |
| 3 | Single document owner and editor commit/navigation lifecycle. | Parts/final stages and browser navigation preserve committed and pending edits. |
| 4 | Processor context, revision invalidation and reconciliation. | Real paint/quality/damage inputs work; reruns refresh defaults while preserving compatible edits. |
| 5 | Editable detailed/collapsed/category views and aggregate policy. | The same cell remains editable and consistent across views; subtotal overrides follow the chosen rules. |
| 6 | Unified server save/load, print, templates and Excel. | Actual API reload plus generated HTML/PDF and workbook cells match the resolved revision. |
| 7 | Remove legacy synchronization/default-price paths; update documentation. | No independent calculator remains in UI/output code; lint/build and targeted suites pass. |

Keep compatibility adapters until the migrated path passes real persistence
and output tests. These phases are dependency ordered and can be reviewed as
separate changes; the final acceptance scenario spans all phases.

## Acceptance tests

Use meaningful unit, API and browser tests, including:

1. Edit every supported row field and a subtotal; navigate back/forward, use
   stage tabs/browser history, change view, save, reload and reopen from server.
   Verify exact edits in final screen, print payload, rendered HTML/PDF and
   Excel cells. Include a manual sum different from estimation × price.
2. Leave a cell editor active and immediately choose Back, Save or Print;
   verify the latest valid edit is committed before the snapshot is read.
3. Change damage/action/paint/quality/rates after editing several cells.
   Unedited defaults update; compatible edits stay; disappearing rows become
   inactive without losing edits. Restore the original action/part and edits.
4. Rename/reorder entities and use duplicate descriptions/processor names;
   verify no edit or rate selection transfers to the wrong entity.
5. Remove a part and verify exclusion from all totals/outputs; restore it and
   verify its edits. Ignore delayed lookups for the removed part/old vehicle.
6. Delay/fail a save, edit during saving and issue another save; verify current
   state and the eventual server file retain the newest revision.
7. Load legacy files with zero, blanks, decimal commas, manual sums, materials,
   missing provenance and duplicate names; verify migration preserves values
   and is idempotent. Test processor errors and required files explicitly.
8. Change company rates/currency and catalog processors after saving; opening
   and printing the saved calculation retains its values/currency until refresh.
9. Test zero/blank rows, rounding boundaries, manual subtotal disagreements,
   row reassignment, reset and undo on desktop and 320px mobile.

Update `docs/calculation-engine.md` and `docs/api.md` with the implemented
contract, and refresh backend/dataman/frontend skill context where relevant.
The existing calculation-engine document describes override clearing and
automatic recomputation behavior that this plan replaces.
