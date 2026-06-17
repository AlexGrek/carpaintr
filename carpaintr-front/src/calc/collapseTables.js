/**
 * Merge per-processor calculation tables into one collapsed table per part.
 */

export function isValidTableEntry(entry) {
  return (
    entry != null &&
    typeof entry === "object" &&
    Array.isArray(entry.result)
  );
}

function rowTotal(row, basePrice = 1) {
  const price = row.price ?? basePrice;
  return row.estimation * price;
}

/**
 * Collapse an array of processor tables into a single merged table.
 * @param {Array} tables - per-processor entries from calculations[partName]
 * @param {number} [basePrice=1]
 * @returns {{ result: Array, total: number }}
 */
export function collapsePartTables(tables, basePrice = 1) {
  if (!Array.isArray(tables)) {
    return { result: [], total: 0 };
  }

  const result = tables
    .filter(isValidTableEntry)
    .flatMap((entry) => entry.result);

  const total = result.reduce((acc, row) => acc + rowTotal(row, basePrice), 0);

  return { result, total };
}

/**
 * Build collapsed tables for every part in calculations.
 * @param {Record<string, Array>} calculations
 * @param {number} [basePrice=1]
 * @returns {Record<string, { result: Array, total: number }>}
 */
export function buildTotalTables(calculations, basePrice = 1) {
  if (!calculations || typeof calculations !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(calculations).map(([partName, tables]) => [
      partName,
      collapsePartTables(tables, basePrice),
    ]),
  );
}

/**
 * Wrap totalTables for PDF/HTML template payload (calc field).
 * @param {Record<string, { result: Array, total: number }>} totalTables
 * @returns {Record<string, Array>}
 */
export function totalTablesForTemplate(totalTables) {
  if (!totalTables || typeof totalTables !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(totalTables).map(([part, table]) => [part, [table]]),
  );
}
