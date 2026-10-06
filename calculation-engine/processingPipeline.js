/** Execute processor defaults without changing the saved inputs or cell edits. */
import {
  evaluate_processor,
  is_supported_repair_type,
  make_sandbox,
  validate_null_tables,
  validate_requirements,
  verify_processor,
} from './processor_evaluator.js';

const messageOf = error => error?.message || String(error);
const requirementList = value => Array.isArray(value) ? [...value] : [];

/**
 * Context is the serializable calculation/source snapshot, using the legacy
 * processor argument contract. Each processor receives its own copy so a
 * processor cannot modify inputs or influence the next processor's defaults.
 * Errors carry processorId so a caller can retain the last successful table.
 */
export function processPart(processors, context, { str = text => text } = {}) {
  const tables = [];
  const logs = [];
  for (const definition of processors ?? []) {
    const processor = verify_processor({
      ...definition,
      requiredTables: requirementList(definition.requiredTables),
      requiredFiles: requirementList(definition.requiredFiles),
      requiredRepairTypes: requirementList(definition.requiredRepairTypes),
    });
    const metadata = {
      processorId: processor.processorId ?? processor.name,
      processorName: processor.name,
      category: processor.category,
      orderingNum: processor.orderingNum,
      tables: processor.requiredTables,
      files: processor.requiredFiles,
    };
    const log = (status, reason, detail, extra = {}) => logs.push({
      ...metadata, status, ...(reason ? { reason } : {}), detail, ...extra,
    });
    let input;
    try {
      input = structuredClone(context);
    } catch (error) {
      log('error', 'invalid_context', `Cannot copy processor inputs: ${messageOf(error)}`);
      continue;
    }
    input.tableData ??= {};
    input.files ??= {};

    const missingFile = processor.requiredFiles.find(file => !Object.hasOwn(input.files, file));
    if (missingFile !== undefined) {
      log('error', 'missing_file', `Required file not loaded: ${missingFile}`);
      continue;
    }
    const nullFile = processor.requiredFiles.find(file => input.files[file] == null);
    if (nullFile !== undefined) {
      log('error', 'null_file', `Required file loaded but data is null: ${nullFile}`);
      continue;
    }
    const missingTable = validate_requirements(processor, input.tableData);
    if (missingTable !== null) {
      log('skipped', 'missing_table', str('Required table "%s" not found. Available: [%s]')
        .replace('%s', missingTable).replace('%s', Object.keys(input.tableData).join(', ')));
      continue;
    }
    const nullTable = validate_null_tables(processor, input.tableData);
    if (nullTable !== null) {
      log('error', 'null_table', str('Table "%s" loaded but data is null — server returned no rows. Required: [%s]')
        .replace('%s', nullTable).replace('%s', processor.requiredTables.join(', ')));
      continue;
    }
    if (!is_supported_repair_type(processor, input.repairAction)) {
      log('skipped', 'unsupported_action', `Action "${input.repairAction}" not in requiredRepairTypes: [${processor.requiredRepairTypes.join(', ')}]`);
      continue;
    }
    let shouldRun;
    try {
      shouldRun = processor.shouldRun(make_sandbox(), input.carPart,
        input.tableData, input.repairAction, input.files, input.carClass,
        input.carBodyType, input.carYear, input.carModel, input.paint, input.pricing);
    } catch (error) {
      log('error', 'shouldRun_threw', `shouldRun() threw: ${messageOf(error)}`);
      continue;
    }
    if (!shouldRun) {
      log('skipped', 'shouldRun_false', 'shouldRun() returned false');
      continue;
    }
    const result = evaluate_processor(processor, input);
    if (result.error) {
      log('error', 'run_threw', result.text);
      continue;
    }
    // Reject nonfinite numeric outputs instead of letting billing turn them
    // into zero. Blank/unfilled cells remain available for the operator to fill.
    const invalid = result.result.find(row => ['estimation', 'price', 'sum'].some(field =>
      typeof row[field] === 'number' && !Number.isFinite(row[field])));
    if (invalid) {
      log('error', 'run_threw', `Processor emitted a nonfinite numeric cell: ${invalid.name}`);
      continue;
    }
    tables.push(result);
    log('applied', null, `${result.result.length} row(s)`, {
      rows: result.result.map(({ name, estimation, tooltip }) => ({ name, estimation, tooltip })),
    });
  }
  return { tables, logs, errors: logs.filter(log => log.status === 'error') };
}
