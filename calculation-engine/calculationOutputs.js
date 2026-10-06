/** Adapt one resolved revision to the legacy document template shapes. */
import {
  buildCategoryTables, buildTotalTables, sanitizeCalcForTemplate, totalTablesForTemplate,
} from './collapseTables.js';
import { localizedCategoryLabel } from './workCategories.js';

export function buildCalculationOutput({
  calculations, collapseTables = false, totalTables, categoryTables,
  grandTotal, currency = '', str = text => text,
}) {
  const byPart = totalTables && Object.keys(totalTables).length
    ? totalTables : buildTotalTables(calculations);
  const byCategory = categoryTables ?? buildCategoryTables(calculations);
  // Keys carry identity. Display labels may be equal or deliberately blank.
  const part_labels = Object.fromEntries(Object.entries(byPart).map(([part, table]) => [part, table.name ?? part]));
  const category_labels = Object.fromEntries(Object.keys(byCategory).map(category => [category, localizedCategoryLabel(category, str)]));
  return {
    calc: sanitizeCalcForTemplate(collapseTables ? totalTablesForTemplate(byPart) : calculations),
    calc_by_category: sanitizeCalcForTemplate(totalTablesForTemplate(byCategory)),
    part_labels,
    category_labels,
    part_totals: Object.fromEntries(Object.entries(byPart).map(([part, table]) => [part, {
      name: table.name ?? part, total: table.total ?? '', computedTotal: table.computedTotal,
    }])),
    currency,
    ...(grandTotal !== undefined ? { grand_total: grandTotal ?? '' } : {}),
  };
}
