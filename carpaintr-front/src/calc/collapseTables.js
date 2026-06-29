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

/**
 * Coerce any value (null, undefined, "", "Unfilled", NaN, ...) into a real
 * finite number. Used so that empty/unfilled cells are treated as zeroes in
 * the document generation payload, where the template engine requires real
 * numbers (a `null` becomes Python `None` → "must be real number" errors).
 * @param {*} value
 * @returns {number}
 */
export function toRealNumber(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function rowTotal(row, basePrice = 1) {
  const price = row.price == null ? basePrice : row.price;
  return toRealNumber(row.estimation) * toRealNumber(price);
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

/**
 * Normalize a single table entry so every numeric field is a real number:
 * each row's `estimation`/`price`/`sum` and the table `total`. Unfilled cells
 * (null/undefined/empty) become zeroes. Non-table entries (e.g. error strings)
 * are returned unchanged.
 * @param {*} table
 * @param {number} [basePrice=1]
 * @returns {*}
 */
export function sanitizeTableEntry(table, basePrice = 1) {
  if (!isValidTableEntry(table)) {
    return table;
  }

  let total = 0;
  const result = table.result.map((row) => {
    const estimation = toRealNumber(row.estimation);
    const price = row.price == null ? basePrice : toRealNumber(row.price);
    const sum = estimation * price;
    total += sum;
    return { ...row, estimation, price, sum };
  });

  return { ...table, result, total };
}

/**
 * Normalize an entire `calc` payload (part -> array of table entries) so all
 * numeric fields are real numbers, ready for the PDF/HTML template engine.
 * @param {Record<string, Array>} calc
 * @param {number} [basePrice=1]
 * @returns {Record<string, Array>}
 */
export function sanitizeCalcForTemplate(calc, basePrice = 1) {
  if (!calc || typeof calc !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(calc).map(([part, tables]) => [
      part,
      Array.isArray(tables)
        ? tables.map((table) => sanitizeTableEntry(table, basePrice))
        : tables,
    ]),
  );
}
