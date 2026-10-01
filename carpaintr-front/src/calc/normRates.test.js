import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyNormRates, companyNormRates, setRateOverride } from "./normRates.js";
import { buildCategoryTables, buildTotalTables, sanitizeCalcForTemplate, withDefaultPrices } from "./collapseTables.js";
import { buildExcelRows } from "./excelExport.js";

const rates = { base: 100, currency: "UAH", additional: [
  { id: "paint", name: "Painting", amount: 250 },
  { id: "arm", name: "Assembly", amount: 150 },
] };
const calculations = () => ({ Hood: [
  { name: "Painting", result: [{ name: "Paint hood", estimation: 2, category: "paint" }] },
  { name: "Assembly", result: [{ name: "Remove hood", estimation: 1, category: "arm" }] },
], Door: [{ name: "Painting", result: [{ name: "Paint door", estimation: 3, category: "paint" }] }] });

describe("multiple norm-hour rates", () => {
  it("defaults old company profiles to a base rate and snapshots additional rates", () => {
    assert.deepEqual(companyNormRates({ pricing_preferences: { norm_price: { amount: "90.50", currency: "UAH" } } }),
      { base: 90.5, currency: "UAH", additional: [] });
    const company = { pricing_preferences: { norm_rates: rates.additional } };
    companyNormRates(company).additional[0].amount = 999;
    assert.equal(company.pricing_preferences.norm_rates[0].amount, 250);
  });

  it("resolves table → part → base and keeps totals consistent in every output", () => {
    let overrides = setRateOverride({}, "Hood", null, "paint");
    overrides = setRateOverride(overrides, "Hood", "Assembly", "arm");
    const priced = applyNormRates(calculations(), rates, overrides);
    assert.deepEqual(priced.Hood.map((table) => table.result[0].price), [250, 150]);
    assert.equal(priced.Door[0].result[0].price, 100);
    const total = Object.values(buildTotalTables(priced)).reduce((sum, table) => sum + table.total, 0);
    assert.equal(total, 950);
    assert.equal(Object.values(buildCategoryTables(priced)).reduce((sum, table) => sum + table.total, 0), total);
    assert.equal(buildExcelRows(priced).grandTotal, total);
    const printable = sanitizeCalcForTemplate(priced);
    assert.equal(printable.Hood[0].result[0].sum, 500);
    assert.equal(applyNormRates(priced, rates, overrides), priced);
  });

  it("reprices managed rows on amount changes, after saving and reopening", () => {
    const overrides = setRateOverride({}, "Hood", null, "paint");
    const saved = JSON.parse(JSON.stringify({ calculations: applyNormRates(calculations(), rates, overrides), rates, overrides }));
    saved.rates.additional[0].amount = 300;
    const priced = applyNormRates(saved.calculations, saved.rates, saved.overrides);
    assert.equal(priced.Hood[0].result[0].sum, 600);
    assert.equal(priced.Hood[1].total, 300);
    assert.equal(priced.Door[0].total, 300);
  });

  it("preserves manual, material and processor prices", () => {
    const rows = [
      { name: "manual", estimation: 2, price: 42, priceSource: "manual" },
      { name: "material", estimation: 2, price: 80, unit: "l" },
      { name: "custom", estimation: 2, price: 90, priceSource: "processor" },
      { name: "labor", estimation: 2 },
    ];
    const priced = applyNormRates({ Hood: [{ name: "Painting", result: rows }] }, rates, setRateOverride({}, "Hood", null, "paint"));
    assert.deepEqual(priced.Hood[0].result.map((row) => row.price), [42, 80, 90, 250]);
  });

  it("preserves old saved row prices until an override is selected", () => {
    const original = { Hood: [{ name: "Painting", result: [{ name: "old", estimation: 2, price: 70 }] }] };
    assert.equal(applyNormRates(original, rates), original);
    const priced = applyNormRates(original, rates, setRateOverride({}, "Hood", null, "paint"));
    assert.equal(priced.Hood[0].result[0].price, 250);
  });

  it("uses a zero rate and falls back to inheritance when a rate is removed", () => {
    let overrides = setRateOverride({}, "Hood", null, "arm");
    overrides = setRateOverride(overrides, "Hood", "Painting", "paint");
    const priced = applyNormRates(calculations(), rates, overrides);
    const deleted = { ...rates, additional: rates.additional.filter((rate) => rate.id !== "paint") };
    assert.equal(applyNormRates(priced, deleted, overrides).Hood[0].result[0].price, 150);
    overrides = setRateOverride(overrides, "Hood", "Painting", "base");
    assert.equal(applyNormRates(priced, { ...rates, base: 0 }, overrides).Hood[0].result[0].sum, 0);
  });

  it("lets generated default prices follow calculation rates without rerunning processors", () => {
    const generated = { Hood: withDefaultPrices(calculations().Hood, 100) };
    const priced = applyNormRates(generated, { ...rates, base: 200 });
    assert.equal(priced.Hood[0].total, 400);
    assert.equal(priced.Hood[1].total, 200);
  });

  it("clears table and part overrides back to their inherited rates", () => {
    let overrides = setRateOverride({}, "Hood", null, "paint");
    overrides = setRateOverride(overrides, "Hood", "Assembly", "arm");
    const priced = applyNormRates(calculations(), rates, overrides);
    overrides = setRateOverride(overrides, "Hood", "Assembly", null);
    assert.equal(applyNormRates(priced, rates, overrides).Hood[1].result[0].price, 250);
    overrides = setRateOverride(overrides, "Hood", null, null);
    assert.equal(applyNormRates(priced, rates, overrides).Hood[1].result[0].price, 100);
  });
});
