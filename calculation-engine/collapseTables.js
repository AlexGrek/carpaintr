/**
 * Merge per-processor calculation tables into one collapsed table per part,
 * or regroup every part's rows by work category.
 */

import { categoryRank, normalizeCategory } from "./workCategories.js";

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
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value !== "string") return 0;
  const literal = value.trim().replace(",", ".");
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(literal)) return 0;
  const number = Number(literal);
  return Number.isFinite(number) ? number : 0;
}

/**
 * The company's price per norm-hour. Preserve an explicit zero: it is the
 * backend default and must display, save and print consistently as 0 rather
 * than silently changing to 1 in a downstream view.
 * @param {*} company - company info as returned by getcompanyinfo
 * @returns {number}
 */
export function normPriceOf(company) {
  return toRealNumber(company?.pricing_preferences?.norm_price?.amount);
}

/**
 * Whether the company has configured a norm-hour price at all.
 * @param {*} company
 * @returns {boolean}
 */
export function hasNormPrice(company) {
  return toRealNumber(company?.pricing_preferences?.norm_price?.amount) > 0;
}

/**
 * Stamp `price` onto every row that has none, so totals, the saved calculation
 * and the print payload all use the same price instead of each consumer
 * applying its own fallback. Returns the input unchanged if nothing needed it.
 * @param {Array} tables - per-processor entries for one part
 * @param {number} price
 * @returns {Array}
 */
export function withDefaultPrices(tables, price) {
  if (!Array.isArray(tables)) return tables;
  let changed = false;
  const next = tables.map((table) => {
    if (!isValidTableEntry(table) || table.result.every((row) => row?.price != null)) {
      return table;
    }
    changed = true;
    const result = table.result.map((row) =>
      row?.price == null
        ? {
            ...row,
            price,
            priceSource: row?.unit ? "processor" : "norm",
            sum: toRealNumber(row?.estimation) * toRealNumber(price),
          }
        : row,
    );
    return {
      ...table,
      result,
      total: result.reduce((total, row) => total + rowSum(row, price), 0),
    };
  });
  return changed ? next : tables;
}

/**
 * `withDefaultPrices` applied to every part of a calculation.
 * @param {Record<string, Array>} calculations
 * @param {number} price
 * @returns {Record<string, Array>}
 */
export function calculationsWithDefaultPrices(calculations, price) {
  if (!calculations || typeof calculations !== "object") return calculations;
  let changed = false;
  const next = Object.fromEntries(
    Object.entries(calculations).map(([part, tables]) => {
      const stamped = withDefaultPrices(tables, price);
      if (stamped !== tables) changed = true;
      return [part, stamped];
    }),
  );
  return changed ? next : calculations;
}

/**
 * A row is "unfilled" when its estimation is not a real number (e.g. the
 * literal "Unfilled" placeholder, null, undefined or ""). Unfilled rows show a
 * "-" in the estimation cell that the user can click to fill in.
 * @param {*} row
 * @returns {boolean}
 */
export function isUnfilledRow(row) {
  return !Number.isFinite(parseFloat(row?.estimation));
}

/**
 * Read a resolved row amount. An explicit sum, including zero or blank, wins.
 * Only legacy rows without a sum use estimation × price.
 * @param {*} row
 * @param {number} [basePrice=1]
 * @returns {number}
 */
export function rowSum(row, basePrice = 1) {
  if (row?.excluded === true) return 0;
  if (row && Object.hasOwn(row, "sum")) return toRealNumber(row.sum);
  const price = row?.price == null ? basePrice : row.price;
  return toRealNumber(row?.estimation) * toRealNumber(price);
}

/**
 * Whether a row amount is zero. This is a display hint only; inclusion in
 * totals and generated documents is controlled by the explicit excluded flag.
 * @param {*} row
 * @param {number} [basePrice=1]
 * @returns {boolean}
 */
export function isZeroSumRow(row, basePrice = 1) {
  return rowSum(row, basePrice) === 0;
}

function rowTotal(row, basePrice = 1) {
  return rowSum(row, basePrice);
}

/**
 * A row is a material (paint, lacquer, primer, ...) rather than labour when it
 * carries a unit of measure. Materials are listed after all labour rows.
 * @param {*} row
 * @returns {boolean}
 */
export function isMaterialRow(row) {
  if (row?.kind != null) return row.kind === "material";
  return typeof row?.unit === "string" && row.unit.trim() !== "";
}

/**
 * Order rows the way the works are actually performed: labour first (by the
 * processor's `orderingNum`), then materials. `Array.prototype.sort` is stable,
 * so rows emitted by the same processor keep the order the processor wrote
 * them in.
 * @param {Array} rows
 * @returns {Array} a new, sorted array
 */
export function sortWorkRows(rows) {
  return [...rows].sort((a, b) => {
    const materialDiff = Number(isMaterialRow(a)) - Number(isMaterialRow(b));
    if (materialDiff !== 0) return materialDiff;
    return (a?.orderingNum ?? 0) - (b?.orderingNum ?? 0);
  });
}

/**
 * Collapse an array of processor tables into a single merged table, ordered by
 * `orderingNum` with material rows pushed to the end.
 * @param {Array} tables - per-processor entries from calculations[partName]
 * @param {number} [basePrice=1]
 * @returns {{ result: Array, total: number }}
 */
export function collapsePartTables(tables, basePrice = 1) {
  if (!Array.isArray(tables)) {
    return { result: [], total: 0 };
  }

  const result = sortWorkRows(
    tables.filter(isValidTableEntry).flatMap((entry) => entry.result.filter((row) => row?.excluded !== true)),
  );

  const total = tables.filter(isValidTableEntry).reduce((acc, table) =>
    acc + (table.total != null || table._explicitTotal ? toRealNumber(table.total) :
      table.result.reduce((sum, row) => sum + rowTotal(row, basePrice), 0)), 0);

  return { result, total };
}

/**
 * Regroup every part's rows by work category instead of by part.
 *
 * Each row is stamped with the part it came from (`part`), since in this view
 * the part is a column rather than the enclosing heading. Categories are
 * returned in trade order (arm → body → paint → extra, uncategorised last) and
 * rows within a category follow `sortWorkRows`.
 *
 * @param {Record<string, Array>} calculations
 * @param {number} [basePrice=1]
 * @returns {Record<string, { result: Array, total: number }>}
 */
export function buildCategoryTables(calculations, basePrice = 1) {
  if (!calculations || typeof calculations !== "object") {
    return {};
  }

  const grouped = new Map();

  for (const [partName, tables] of Object.entries(calculations)) {
    if (!Array.isArray(tables)) continue;
    for (const entry of tables.filter(isValidTableEntry)) {
      for (const row of entry.result) {
        if (row?.excluded === true) continue;
        const category = row?._overrides?.includes("category")
          ? String(row.category ?? "") : normalizeCategory(row?.category);
        if (!grouped.has(category)) grouped.set(category, []);
        grouped.get(category).push({ ...row, part: row.part ?? partName });
      }
    }
  }

  const ordered = [...grouped.keys()].sort(
    (a, b) => categoryRank(a) - categoryRank(b),
  );

  return Object.fromEntries(
    ordered.map((category) => {
      const result = sortWorkRows(grouped.get(category));
      const total = result.reduce(
        (acc, row) => acc + rowTotal(row, basePrice),
        0,
      );
      return [category, { result, total }];
    }),
  );
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
 * each row's `estimation`/`price`/`sum` and the table `total`. Explicit blanks
 * and zeroes remain present; missing legacy amounts get a fallback. Non-table entries (e.g. error strings)
 * are returned unchanged.
 * @param {*} table
 * @param {number} [basePrice=1]
 * @returns {*}
 */
export function sanitizeTableEntry(table, basePrice = 1) {
  if (!isValidTableEntry(table)) {
    return table;
  }

  // Preserve authored blanks and zero amounts. Exclusion is an explicit choice,
  // never inferred from a price, estimate, or amount.
  const result = sortWorkRows(table.result)
    .filter((row) => row?.excluded !== true)
    .map((row) => {
      const estimation = row.estimation == null || row.estimation === ""
        ? row.estimation ?? "" : toRealNumber(row.estimation);
      const price = row.price == null
        ? row._explicitSum || row._overrides?.includes("price") ? "" : basePrice
        : row.price === "" ? "" : toRealNumber(row.price);
      const sum = Object.hasOwn(row, "sum")
        ? row.sum == null || row.sum === "" ? "" : toRealNumber(row.sum)
        : rowSum(row, basePrice);
      return { ...row, estimation, price, sum };
    });
  const total = table.total != null || table._explicitTotal
    ? table.total == null || table.total === "" ? "" : toRealNumber(table.total)
    : result.reduce((acc, row) => acc + rowSum(row, basePrice), 0);

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
