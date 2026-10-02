import { describe, it } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { buildCalculationWorkbook, buildExcelRows } from "./excelExport.js";

const calculations = { Hood: [{ name: "Renamed processor", total: 71, result: [
  { id: "a", name: "Authored description", part: "Edited hood", category: "paint", unit: "л", estimation: 2, price: 100, sum: 17 },
  { id: "b", name: "No charge", category: "paint", estimation: 1, price: 100, sum: 0 },
  { id: "c", name: "Blank amount", category: "paint", estimation: "", price: "", sum: "" },
] }] };
const categoryTables = { paint: { total: 51, computedTotal: 17, result: calculations.Hood[0].result } };

describe("resolved spreadsheet snapshot", () => {
  it("uses the supplied category and grand totals without rewriting row amounts", () => {
    const rows = buildExcelRows(calculations, 1, { categoryTables, grandTotal: 91 });
    assert.equal(rows.groups[0].rows.length, 3);
    assert.equal(rows.groups[0].rows.find(row => row.id === "a").sum, 17);
    assert.equal(rows.groups[0].total, 51);
    assert.equal(rows.grandTotal, 91);
  });

  it("retains edited cells, zero rows, blank cells, currency and totals in an actual XLSX roundtrip", async () => {
    const workbook = await buildCalculationWorkbook({ calculations, categoryTables, grandTotal: 91, currency: "EUR", totalTables: { Hood: { name: "Edited hood", total: 63, computedTotal: 42 } } });
    const reloaded = new ExcelJS.Workbook();
    await reloaded.xlsx.load(await workbook.xlsx.writeBuffer());
    const sheet = reloaded.getWorksheet("Calculation");
    assert.equal(sheet.getCell("F1").value, "Price (EUR)");
    assert.equal(sheet.getCell("B4").value, "Edited hood");
    assert.equal(sheet.getCell("C4").value, "Authored description");
    assert.equal(sheet.getCell("E4").value, "л");
    assert.equal(sheet.getCell("G4").value, 17);
    assert.equal(sheet.getCell("G2").value, 0);
    assert.equal(sheet.getCell("D3").value, "");
    assert.equal(sheet.getCell("G3").value, "");
    assert.equal(sheet.getCell("G5").value, 51);
    assert.equal(sheet.getCell("G6").value, 91);
    assert.match(sheet.getCell("G5").note, /Computed subtotal: 17/);
    const parts = reloaded.getWorksheet("Part totals");
    assert.equal(parts.getCell("A2").value, "Edited hood");
    assert.equal(parts.getCell("B2").value, 63);
    assert.equal(parts.getCell("C2").value, 42);
    assert.equal(parts.getCell("D2").value, 21);
  });
});

it('exports custom and blank category groups, edited row ordering, and tooltip cells', async () => {
  const calculations = { Hood: [{ result: [
    { name: 'Later custom row', category: 'Custom finishing', orderingNum: 20, tooltip: 'Later instruction', sum: 17, _overrides: ['category', 'tooltip'] },
    { name: 'Earlier custom row', category: 'Custom finishing', orderingNum: -1, tooltip: 'Authored instruction', sum: 2, _overrides: ['category', 'orderingNum', 'tooltip'] },
    { name: 'Blank category row', category: '', orderingNum: 0, sum: 0, _overrides: ['category'] },
  ] }] };
  const output = buildExcelRows(calculations);
  assert.deepEqual(output.groups.map(group => group.category), ['Custom finishing', '']);
  const workbook = await buildCalculationWorkbook({ calculations, currency: 'EUR' });
  const loaded = new ExcelJS.Workbook();
  await loaded.xlsx.load(await workbook.xlsx.writeBuffer());
  const sheet = loaded.getWorksheet('Calculation');
  assert.equal(sheet.getCell('A2').value, 'Custom finishing');
  assert.equal(sheet.getCell('C2').value, 'Earlier custom row');
  assert.equal(sheet.getCell('H2').value, 'Authored instruction');
  assert.equal(sheet.getCell('I2').value, -1);
  assert.equal(sheet.getCell('C3').value, 'Later custom row');
  assert.equal(sheet.getCell('A5').value, '');
  assert.equal(sheet.getCell('C5').value, 'Blank category row');
  assert.equal(sheet.getCell('I1').value, 'Ordering');
});
