import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { processPart } from './processingPipeline.js';
import { evaluateExpression } from './processor_evaluator.js';

const context = () => ({
  carPart: { name: 'Капот', damageLevel: 2, grid: [[0, 1]] },
  repairAction: 'Ремонт з зовнішнім фарбуванням',
  tableData: {}, files: {}, carClass: 'B', carBodyType: 'СЕДАН',
  carYear: 2020, carModel: 'Golf', paint: 'Яскравий червоний',
  pricing: { quality: 'Офіційне СТО', paintType: '3шарове фарбування' },
});
const processor = overrides => ({
  name: 'Test processor', processorId: 'test.js',
  run: () => [{ name: 'Test «деталь»', evaluate: '2', tooltip: 'Trace' }],
  ...overrides,
});

describe('pure part processing pipeline', () => {
  it('runs the actual painting processor with real paint, quality and vehicle inputs', async () => {
    const source = await readFile(new URL('../../../data/common/procs/ФАРБУВАННЯ.js', import.meta.url), 'utf8');
    const painting = new Function(`return ${source}`)();
    painting.processorId = 'ФАРБУВАННЯ.js';
    const input = context();
    input.tableData['Нормы материалов и работ для покраски'] = {
      'н.ч. грунтование в цвет': '0,3', 'н.ч. покраска': '2,5',
      'расход л. краски1': '0,1', 'расход л. краски2': '0,2', 'расхода л. Лак': '0,15',
      'грунт аерозольний': '30',
    };
    const output = processPart([painting], input);
    assert.deepEqual(output.errors, []);
    assert.equal(output.tables.length, 1);
    assert.deepEqual(output.tables[0].result.map(row => row.estimation), [0.3, 2.5, 0.1, 0.2, 0.15]);
    assert.equal(output.tables[0].result[1].name, 'Фарбування «Капот»');
    assert.equal(output.tables[0].result[1].category, 'paint');
    assert.equal(output.tables[0].result[2].unit, 'л');
    assert.equal(output.logs[0].status, 'applied');
    assert.equal(output.logs[0].processorId, 'ФАРБУВАННЯ.js');

    input.paint = 'Білий'; input.pricing.quality = 'Стандарт'; input.pricing.paintType = '2шарове';
    const standard = processPart([painting], input);
    assert.equal(standard.tables[0].result.at(-1).name, 'Грунт аерозольний');
    assert.equal(standard.tables[0].result.at(-1).estimation, 30);
  });

  it('reports missing and null tables with the established debug reasons', () => {
    const proc = processor({ requiredTables: ['norms'] });
    const missing = processPart([proc], context());
    assert.equal(missing.logs[0].status, 'skipped');
    assert.equal(missing.logs[0].reason, 'missing_table');
    assert.equal(missing.errors.length, 0);
    const input = context(); input.tableData.norms = null;
    const unavailable = processPart([proc], input);
    assert.equal(unavailable.errors[0].reason, 'null_table');
    assert.equal(unavailable.errors[0].processorId, 'test.js');
    assert.deepEqual(unavailable.tables, []);
  });

  it('validates required files and passes their original parsed values', () => {
    const proc = processor({ requiredFiles: ['quality.yaml'], run: (_x, _part, _tables, _action, files) => [{ name: 'File default', estimation: files['quality.yaml'].factor }] });
    assert.equal(processPart([proc], context()).errors[0].reason, 'missing_file');
    const input = context(); input.files['quality.yaml'] = null;
    assert.equal(processPart([proc], input).errors[0].reason, 'null_file');
    input.files['quality.yaml'] = { factor: 1.5 };
    assert.equal(processPart([proc], input).tables[0].result[0].estimation, 1.5);
  });

  it('keeps successful tables when another processor fails', () => {
    const good = processor({ processorId: 'good.js' });
    const broken = processor({ processorId: 'broken.js', run: () => { throw new Error('Formula unavailable'); } });
    const result = processPart([good, broken], context());
    assert.equal(result.tables.length, 1);
    assert.equal(result.tables[0].processorId, 'good.js');
    assert.equal(result.errors[0].reason, 'run_threw');
    assert.equal(result.errors[0].processorId, 'broken.js');
    assert.match(result.errors[0].detail, /Formula unavailable/);
  });

  it('distinguishes an unsupported action, a false condition, and a thrown condition', () => {
    const result = processPart([
      processor({ requiredRepairTypes: ['different'] }),
      processor({ shouldRun: () => false }),
      processor({ shouldRun: () => { throw new Error('Invalid context'); } }),
    ], context());
    assert.deepEqual(result.logs.map(log => log.reason), ['unsupported_action', 'shouldRun_false', 'shouldRun_threw']);
    assert.equal(result.errors.length, 1);
  });

  it('does not let processor mutations alter the source snapshot or another processor', () => {
    const input = context(); input.tableData.norms = { amount: '2,5' };
    const before = structuredClone(input);
    const definitions = [
      processor({ run: (_x, part, tables, _action, files) => {
        part.grid[0][0] = 99; tables.norms.amount = '99'; files.fake = 'mutated';
        return [{ name: 'Mutator', estimation: 1 }];
      } }),
      processor({ run: (_x, part, tables, _action, files) => {
        assert.equal(part.grid[0][0], 0); assert.equal(tables.norms.amount, '2,5'); assert.equal(files.fake, undefined);
        return [{ name: 'Reader', evaluate: tables.norms.amount }];
      } }),
    ];
    const output = processPart(definitions, input);
    assert.equal(output.tables[1].result[0].estimation, 2.5);
    assert.deepEqual(input, before);
    assert.equal(definitions[0].requiredFiles, undefined);
  });

  it('rejects nonfinite expressions and directly emitted nonfinite numeric cells', () => {
    const output = processPart([
      processor({ run: () => [{ name: 'Infinite formula', evaluate: '1 / 0' }] }),
      processor({ run: () => [{ name: 'Infinite price', estimation: 1, price: Infinity }] }),
      processor({ run: () => [{ name: 'Unfilled', estimation: 'Unfilled' }] }),
    ], context());
    assert.equal(output.errors.length, 2);
    assert.equal(output.tables.length, 1);
    assert.equal(output.tables[0].result[0].estimation, 'Unfilled');
  });
});

describe('processor numeric compatibility', () => {
  it('parses decimal commas only for complete numeric literals', () => {
    assert.equal(evaluateExpression('1,5'), 1.5);
    assert.equal(evaluateExpression('-0,25'), -0.25);
    assert.equal(evaluateExpression('Math.max(1, 2) * 2'), 4);
    // This is JavaScript comma syntax, not a localized arithmetic expression.
    assert.equal(evaluateExpression('1,5 + 2,5'), 5);
    assert.equal(evaluateExpression('1.5 + 2.5'), 4);
  });

  it('rejects invalid or nonfinite evaluated numbers', () => {
    for (const value of [NaN, Infinity, '-Infinity', '0 / 0', '"not a number"']) {
      assert.throws(() => evaluateExpression(value), /finite number/);
    }
    assert.throws(() => evaluateExpression('bad syntax here'));
  });
});
