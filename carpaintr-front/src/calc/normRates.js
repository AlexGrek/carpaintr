import { isMaterialRow, isValidTableEntry, rowSum, toRealNumber } from "./collapseTables.js";

export const BASE_RATE_ID = "base";

export function companyNormRates(company) {
  const pricing = company?.pricing_preferences;
  return {
    base: toRealNumber(pricing?.norm_price?.amount),
    currency: pricing?.norm_price?.currency ?? "",
    additional: (pricing?.norm_rates ?? []).map((rate) => ({ ...rate })),
  };
}

export function rateAmount(rates, id = BASE_RATE_ID) {
  const rate = rates?.additional?.find((rate) => rate.id === id);
  return toRealNumber(rate ? rate.amount : rates?.base);
}

export function setRateOverride(overrides, part, table, id) {
  const entry = { ...overrides?.[part] };
  if (table == null) entry.rateId = id;
  else entry.tables = { ...entry.tables, [table]: id };
  return { ...overrides, [part]: entry };
}

// Resolve and stamp prices before totals, save, print, or Excel read the rows.
// Managed prices follow rate edits; manual and processor/material prices stay
// intact. Legacy saved prices stay intact until a part/table override is chosen.
export function applyNormRates(calculations, rates, overrides = {}) {
  if (!rates || !calculations) return calculations;
  let changed = false;
  const next = Object.fromEntries(Object.entries(calculations).map(([part, tables]) => {
    if (!Array.isArray(tables)) return [part, tables];
    let partChanged = false;
    const entry = overrides[part];
    const nextTables = tables.map((table) => {
      if (!isValidTableEntry(table)) return table;
      const exists = (id) => id === BASE_RATE_ID || rates.additional.some((rate) => rate.id === id);
      const tableId = entry?.tables?.[table.name];
      const partId = entry?.rateId;
      const selected = exists(tableId) ? tableId : exists(partId) ? partId : null;
      const id = selected || BASE_RATE_ID;
      const price = rateAmount(rates, id);
      let tableChanged = false;
      const result = table.result.map((row) => {
        if (!row || isMaterialRow(row) || row.priceSource === "manual" || row.priceSource === "processor") return row;
        if (row.price != null && row.priceSource !== "norm" && !selected) return row;
        const sum = rowSum({ ...row, price });
        if (row.price === price && row.priceSource === "norm" && row.normRateId === id && row.sum === sum) return row;
        tableChanged = true;
        return { ...row, price, priceSource: "norm", normRateId: id, sum };
      });
      if (!tableChanged) return table;
      partChanged = true;
      return { ...table, result, total: result.reduce((acc, row) => acc + rowSum(row), 0) };
    });
    changed ||= partChanged;
    return [part, partChanged ? nextTables : tables];
  }));
  return changed ? next : calculations;
}
