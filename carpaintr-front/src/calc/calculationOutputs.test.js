import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildCalculationOutput } from './calculationOutputs.js';

const table = (id, name, sum) => ({ result: [{ id, name, sum, estimation: 1, price: 100 }], total: sum });

describe('stable document output identities', () => {
  it('keeps distinct categories whose translated display labels collide', () => {
    const categoryTables = { paint: table('paint-row', 'Paint row', 17), 'Paint works': table('custom-row', 'Custom row', 2), '': table('blank-row', 'Blank row', 0) };
    const output = buildCalculationOutput({ calculations: {}, categoryTables, grandTotal: 19, str: text => text });
    assert.deepEqual(Object.keys(output.calc_by_category), ['paint', 'Paint works', '']);
    assert.equal(output.category_labels.paint, 'Paint works');
    assert.equal(output.category_labels['Paint works'], 'Paint works');
    assert.equal(output.category_labels[''], '');
    assert.equal(output.calc_by_category.paint[0].result[0].id, 'paint-row');
    assert.equal(output.calc_by_category['Paint works'][0].result[0].id, 'custom-row');
    assert.equal(output.calc_by_category[''][0].result[0].id, 'blank-row');
  });

  it('keeps duplicate edited part labels separate and exposes their authored totals', () => {
    const calculations = { Hood: [table('hood-row', 'Hood work', 17)], Door: [table('door-row', 'Door work', 2)] };
    const totalTables = { Hood: { ...table('hood-row', 'Hood work', 17), name: 'Edited part', total: 63 }, Door: { ...table('door-row', 'Door work', 2), name: 'Edited part', total: 9 } };
    for (const collapseTables of [false, true]) {
      const output = buildCalculationOutput({ calculations, totalTables, collapseTables, grandTotal: 91, currency: 'EUR' });
      assert.deepEqual(Object.keys(output.calc), ['Hood', 'Door']);
      assert.deepEqual(output.part_labels, { Hood: 'Edited part', Door: 'Edited part' });
      assert.equal(output.part_totals.Hood.total, 63);
      assert.equal(output.part_totals.Door.total, 9);
      assert.equal(output.currency, 'EUR');
      assert.equal(output.grand_total, 91);
    }
  });

  it('renders deliberate blank part and grand totals as blanks rather than null literals', () => {
    const output = buildCalculationOutput({ calculations: {}, totalTables: { Hood: { result: [], name: '', total: null, _explicitTotal: true } }, grandTotal: null });
    assert.equal(output.part_labels.Hood, '');
    assert.equal(output.part_totals.Hood.total, '');
    assert.equal(output.grand_total, '');
  });
});

 it('preserves authored reserved category names as ordinary labels', () => {
  const output = buildCalculationOutput({ calculations: {}, categoryTables: Object.fromEntries(['constructor', '__proto__', 'toString'].map(name => [name, {result: [], total: 0}])) });
  for (const name of ['constructor', '__proto__', 'toString']) assert.equal(output.category_labels[name], name);
 });
