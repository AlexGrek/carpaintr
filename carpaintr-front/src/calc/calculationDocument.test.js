import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { applyGenerated, editCell, resetCell, resolveDocument, selectParts, migrateDocument, partScopeId, categoryScopeId, GRAND_TOTAL_ID, hasInvalidDrafts, parseCell, money, multiplyMoney, sumMoney } from './calculationDocument.js';

const initial = () => resolveDocument({ schemaVersion: 2, generatedCalculations: { Hood: [{ name: 'Painting', processorId: 'paint.js', result: [
  { key: 'coat', name: 'Paint hood', estimation: 2, category: 'paint' },
  { key: 'material', name: 'Paint', unit: 'л', estimation: 3 },
] }] }, cellOverrides: {}, parts: { selectedParts: [{ name: 'Hood', action: 'paint' }] }, normRates: { base: 100, currency: 'EUR', additional: [] } });
const rowOf = doc => doc.calculations.Hood[0].result.find(row => row.key === 'coat');
const change = (doc, id, field, value) => resolveDocument(editCell(doc, id, field, value));

describe('editable calculation document', () => {
  it('resolves labor rates but leaves material prices unpriced', () => {
    const doc = initial();
    assert.equal(rowOf(doc).sum, 200);
    assert.equal(doc.calculations.Hood[0].result[1].price, null);
    assert.equal(doc.grandTotal, 200);
  });
  it('preserves every edited cell through JSON save/load', () => {
    let doc = initial();
    const id = rowOf(doc).id;
    const values = { name: 'Custom', estimation: 4.5, price: 75, sum: 11, unit: 'hours', category: 'body', orderingNum: 12, tooltip: 'My notes' };
    for (const [field, value] of Object.entries(values)) doc = change(doc, id, field, String(value));
    doc = resolveDocument(JSON.parse(JSON.stringify(doc)));
    for (const [field, value] of Object.entries(values)) assert.equal(rowOf(doc)[field], value);
    assert.equal(doc.grandTotal, 11);
  });
  it('manual sum survives estimation/price/rate changes until reset', () => {
    let doc = initial(); const id = rowOf(doc).id;
    doc = change(doc, id, 'sum', '42'); doc = change(doc, id, 'estimation', '5');
    doc = resolveDocument({ ...doc, normRates: { ...doc.normRates, base: 500 } });
    assert.equal(rowOf(doc).sum, 42);
    doc = resolveDocument(resetCell(doc, id, 'sum'));
    assert.equal(rowOf(doc).sum, 2500);
  });
  it('manual price does not freeze generated estimation or depend on edited units', () => {
    let doc = initial(); const id = rowOf(doc).id;
    doc = change(doc, id, 'unit', 'hours'); assert.equal(rowOf(doc).price, 100);
    doc = change(doc, id, 'price', '25');
    doc = resolveDocument(applyGenerated(doc, 'Hood', [{ name: 'New title', processorId: 'paint.js', result: [{ key: 'coat', name: 'Changed name', estimation: 4, category: 'paint' }] }], 'new'));
    assert.equal(rowOf(doc).id, id); assert.equal(rowOf(doc).price, 25);
    assert.equal(rowOf(doc).estimation, 4); assert.equal(rowOf(doc).sum, 100);
  });
  it('blank and zero are literal overrides distinct from reset', () => {
    let doc = initial(); const id = rowOf(doc).id;
    doc = change(doc, id, 'sum', ''); assert.equal(rowOf(doc).sum, null); assert.equal(doc.grandTotal, 0);
    doc = change(doc, id, 'price', '0'); assert.equal(rowOf(doc).price, 0);
    doc = resolveDocument(resetCell(doc, id, 'price')); assert.equal(rowOf(doc).price, 100); assert.equal(rowOf(doc).sum, null);
  });
  it('invalid drafts persist without corrupting committed numeric cells', () => {
    let doc = initial(); const id = rowOf(doc).id;
    doc = change(doc, id, 'price', 'oops'); assert.equal(rowOf(doc).price, 100);
    assert.equal(doc.cellDrafts[id].price, 'oops'); assert.equal(hasInvalidDrafts(doc), true);
    doc = change(doc, id, 'price', '25,5'); assert.equal(rowOf(doc).price, 25.5); assert.equal(hasInvalidDrafts(doc), false);
  });
  it('deleting/restoring a part removes billing and preserves overrides', () => {
    let doc = initial(); const id = rowOf(doc).id;
    doc = change(doc, id, 'sum', '17'); doc = resolveDocument(selectParts(doc, []));
    assert.equal(doc.grandTotal, 0); assert.deepEqual(doc.calculations, {});
    doc = resolveDocument(selectParts(doc, [{ name: 'Hood', action: 'paint' }]));
    assert.equal(rowOf(doc).sum, 17); assert.equal(rowOf(doc).id, id);
  });
  it('part/category/grand literal totals survive load and report arithmetic', () => {
    let doc = initial();
    doc = change(doc, doc.calculations.Hood[0].id, 'total', '91');
    doc = change(doc, partScopeId('Hood'), 'total', '93');
    doc = change(doc, categoryScopeId('paint'), 'total', '95');
    doc = change(doc, GRAND_TOTAL_ID, 'total', '97');
    doc = resolveDocument(JSON.parse(JSON.stringify(doc)));
    assert.equal(doc.calculations.Hood[0].total, 91); assert.equal(doc.totalTables.Hood.total, 93);
    assert.equal(doc.totalTables.Hood.computedTotal, 91); assert.equal(doc.categoryTables.paint.total, 95);
    assert.equal(doc.grandTotal, 97); assert.equal(doc.computedGrandTotal, 93);
  });
  it('duplicate descriptions edit independently and explicit keys reorder safely', () => {
    let doc = resolveDocument({ ...initial(), generatedCalculations: { Hood: [{ name: 'Same', processorId: 'p', result: [{ key: 'a', name: 'Same', estimation: 1 }, { key: 'b', name: 'Same', estimation: 2 }] }] } });
    const id = doc.calculations.Hood[0].result[0].id; doc = change(doc, id, 'name', 'Edited');
    doc = resolveDocument(applyGenerated(doc, 'Hood', [{ name: 'Same', processorId: 'p', result: [{ key: 'b', name: 'Same', estimation: 3 }, { key: 'a', name: 'Same', estimation: 4 }] }], 'r'));
    assert.equal(doc.calculations.Hood[0].result[1].id, id);
    assert.equal(doc.calculations.Hood[0].result[1].name, 'Edited'); assert.equal(doc.calculations.Hood[0].result[0].name, 'Same');
  });
  it('a disappearing edited row recovers its identity when its action returns', () => {
    let doc = initial(); const id = rowOf(doc).id; doc = change(doc, id, 'sum', '17');
    const table = doc.generatedCalculations.Hood[0];
    doc = resolveDocument(applyGenerated(doc, 'Hood', [], 'other-action'));
    assert.equal(doc.grandTotal, 0); assert.equal(doc.inactiveRows.Hood[0].id, id);
    doc = resolveDocument(applyGenerated(doc, 'Hood', [table], 'original-action'));
    assert.equal(rowOf(doc).sum, 17); assert.equal(rowOf(doc).id, id); assert.equal(doc.inactiveRows.Hood.length, 0);
  });
  it('legacy migration is idempotent and preserves unknown manual sums', () => {
    const raw = { car: { year: '2020' }, parts: { calculations: { Hood: [{ name: 'p', total: '42', result: [{ name: 'x', estimation: '2', price: '5', sum: '42' }] }] } }, extra: { unknown: true } };
    const doc = resolveDocument(raw); assert.equal(doc.calculations.Hood[0].result[0].sum, '42');
    assert.equal(doc.calculations.Hood[0].total, '42'); assert.equal(migrateDocument(doc), doc);
    assert.deepEqual(doc.extra, raw.extra); assert.deepEqual(resolveDocument(JSON.parse(JSON.stringify(doc))), doc);
  });
  it('excluded rows remain edited but contribute no amount', () => {
    let doc = initial(); doc = resolveDocument(editCell(doc, rowOf(doc).id, 'excluded', true));
    assert.equal(rowOf(doc).excluded, true); assert.equal(doc.grandTotal, 0);
  });
  it('numeric parsing rejects nonfinite and trailing garbage', () => {
    for (const value of ['NaN', 'Infinity', '12abc', '1.2.3']) assert.ok(parseCell(value, true).error);
    assert.equal(parseCell('0', true).value, 0); assert.equal(parseCell('', true).value, null);
  });
});

 it('uses decimal arithmetic with symmetric half rounding', () => {
  assert.equal(money(1.005), 1.01); assert.equal(money(-1.005), -1.01);
  assert.equal(multiplyMoney(0.1, 10.05), 1.01);
  assert.equal(sumMoney([0.1, 0.2, 0.005]), 0.31);
  assert.equal(multiplyMoney(1e-7, 1e7), 1);
 });

 it('retains ambiguous legacy rate selections without applying them to duplicate tables', () => {
  const doc = resolveDocument({ calculations: { Hood: [{ name: 'Duplicate', result: [{ name: 'A', estimation: 1, priceSource: 'norm' }] }, { name: 'Duplicate', result: [{ name: 'B', estimation: 1, priceSource: 'norm' }] }] }, normRates: { base: 100, additional: [{id: 'special', amount: 500}] }, normRateOverrides: { Hood: {tables: {Duplicate: 'special'}} } });
  assert.equal(doc.grandTotal, 200); assert.equal(doc.normRateOverrides.Hood.tables.Duplicate, 'special');
 });

 it('preserves legacy deliberate null price, sum and table total', () => {
  const doc = resolveDocument({ calculations: { Hood: [{ name: 'p', total: null, result: [{ name: 'x', estimation: 2, price: null, sum: null }] }] }, normRates: { base: 100, additional: [] } });
  assert.equal(doc.calculations.Hood[0].result[0].price, null);
  assert.equal(doc.calculations.Hood[0].result[0].sum, null); assert.equal(doc.calculations.Hood[0].total, null);
  assert.equal(hasInvalidDrafts(doc), false);
 });
 it('does not transfer edits between ambiguous duplicate processor tables', () => {
  let doc = resolveDocument({ calculations: { Hood: [{ name: 'Same', result: [{ name: 'Same row', estimation: 1 }] }, { name: 'Same', result: [{ name: 'Same row', estimation: 2 }] }] } });
  const id = doc.calculations.Hood[0].result[0].id; doc = change(doc, id, 'name', 'Authored');
  doc = resolveDocument(applyGenerated(doc, 'Hood', [{ name: 'Same', result: [{ name: 'Same row', estimation: 2 }] }, { name: 'Same', result: [{ name: 'Same row', estimation: 1 }] }], 'r'));
  assert.ok(doc.calculations.Hood.every(table => table.result[0].name === 'Same row'));
  assert.ok(doc.inactiveRows.Hood.some(row => row.id === id));
 });

 it('adopts new processor row keys through unique legacy source traces', () => {
  let doc = resolveDocument({ calculations: { Hood: [{ name: 'Paint', result: [{ name: 'Legacy', estimation: 2, trace: {table: 'T', field: 'hours'} }] }] } });
  const id = doc.calculations.Hood[0].result[0].id; doc = change(doc, id, 'sum', '17');
  doc = resolveDocument(applyGenerated(doc, 'Hood', [{ name: 'Paint', processorId: 'paint.js', result: [{ key: 'clause-stable', name: 'Generated', estimation: 3, trace: {table: 'T', field: 'hours'} }] }], 'r'));
  assert.equal(doc.calculations.Hood[0].result[0].id, id); assert.equal(doc.calculations.Hood[0].result[0].sum, 17);
 });

 it('migrates legacy uppercase VIN into the server vin field idempotently', () => {
  const doc = resolveDocument({ car: {VIN: 'VIN-EDIT', year: '2020'} });
  assert.equal(doc.car.vin, 'VIN-EDIT'); assert.equal(Object.hasOwn(doc.car, 'VIN'), false);
  assert.equal(migrateDocument(doc), doc);
 });
