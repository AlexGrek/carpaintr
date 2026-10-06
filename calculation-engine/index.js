import { migrateDocument, resolveDocument, selectParts, editCell, resetCell, applyGenerated, restoreInactiveRow, hasInvalidDrafts, processingFingerprint, GRAND_TOTAL_ID, parseCell, numericFields } from './calculationDocument.js';
import { processPart } from './processingPipeline.js';
import { buildProcessorContext } from './processorContext.js';
import { verify_processor } from './processor_evaluator.js';
import { buildCalculationOutput } from './calculationOutputs.js';

// JSON-only boundary shared by the Rust host and browser-engine parity tests.
export function execute({ document: raw, changes = {}, process = false, inspect_processors = false, language = 'uk' }) {
  let doc = migrateDocument(raw);
  if (inspect_processors) {
    const exports = {};
    new Function('exports', doc.processorSnapshot ?? 'exports.default=[]')(exports);
    return { required_files: [...new Set(exports.default.flatMap(p => p.requiredFiles ?? []))] };
  }
  for (const field of ['car', 'paint', 'order', 'normRates', 'normRateOverrides', 'inputOverrides']) {
    if (changes[field] !== undefined) doc = { ...doc, [field]: { ...doc[field], ...changes[field] } };
  }
  if (!doc.order?.orderNumber?.trim()) doc = { ...doc, order: { ...doc.order, orderNumber: '001' } };
  if (changes.repairQuality !== undefined) doc = { ...doc, parts: { ...doc.parts, repairQuality: changes.repairQuality } };
  if (changes.parts !== undefined) {
    doc = selectParts(doc, changes.parts);
    // A restored archived part inherits its prior action unless explicitly cleared.
    for (const part of doc.parts.selectedParts) {
      if (changes.parts.find(input => input.name === part.name)?.selectedAction === null) {
        part.selectedAction = null; part.action = null;
      }
    }
  }
  if (process && doc.processorSnapshot) {
    const exports = {};
    new Function('exports', doc.processorSnapshot)(exports);
    const processors = exports.default.map(verify_processor).sort((a,b) => (a.orderingNum ?? 0) - (b.orderingNum ?? 0));
    for (const part of doc.parts?.selectedParts ?? []) {
      if (!part.selectedAction && !part.action) continue;
      const snapshot = doc.sourceSnapshot?.[part.name];
      if (!snapshot) continue;
      const context = buildProcessorContext(doc, part, snapshot.tables, doc.processorFiles ?? {}, doc.pricingSnapshot ?? {});
      const fingerprint = processingFingerprint({ context, processors: processors.map(p => [p.processorId, p.version]) });
      if (doc.processing?.[part.name]?.fingerprint === fingerprint) continue;
      const {tables, errors} = processPart(processors, context);
      const failed = new Set(errors.map(error => error.processorId));
      const preserved = (doc.generatedCalculations[part.name] ?? []).filter(table => failed.has(table.processorId ?? table.name));
      doc = applyGenerated(doc, part.name, [...tables, ...preserved], fingerprint, errors);
    }
  }
  for (const edit of changes.edits ?? []) {
    const resolved = resolveDocument(doc);
    const entities = new Set([GRAND_TOTAL_ID, ...Object.values(resolved.calculations).flatMap(tables => tables.flatMap(table => [table.id, ...(table.result ?? []).map(row => row.id)])), ...Object.values(resolved.totalTables).map(t => t.id), ...Object.values(resolved.categoryTables).map(t => t.id), ...(doc.parts?.selectedParts ?? []).map(p => p.id)]);
    if (!entities.has(edit.entity_id)) throw new Error('Unknown active entity / Невідома активна сутність');
    if (edit.reset) doc = resetCell(doc, edit.entity_id, edit.field);
    else doc = editCell(doc, edit.entity_id, edit.field, edit.value);
  }
  for (const entry of changes.restore_rows ?? []) {
    if (!doc.inactiveRows?.[entry.part]?.some(row => row.id === entry.row_id)) throw new Error('Unknown archived row / Невідомий архівований рядок');
    doc = restoreInactiveRow(doc, entry.part, entry.row_id);
  }
  doc = resolveDocument(doc);
  const missing = [];
  if (!doc.car?.carClass) missing.push('car.carClass');
  if (!doc.car?.bodyType) missing.push('car.bodyType');
  if (!doc.parts?.selectedParts?.length) missing.push('parts');
  if (doc.parts?.selectedParts?.length && !doc.car?.year) missing.push('car.year');
  for (const part of doc.parts?.selectedParts ?? []) {
    const action = part.selectedAction || part.action || '';
    if (/фарб|розтон|paint|toning/i.test(action) && !/без фарб/i.test(action) && !doc.paint?.paintType) missing.push('paint.paintType');
    if (!part.selectedAction && !part.action) missing.push(`parts.${part.name}.action`);
    else if (!doc.generatedCalculations[part.name]?.length) missing.push(`parts.${part.name}.results`);
  }
  const errors = Object.values(doc.processing ?? {}).flatMap(p => p.errors ?? []);
  const invalid = hasInvalidDrafts(doc);
  const invalid_cells = Object.entries(doc.cellDrafts ?? {}).flatMap(([entity_id, fields]) => Object.entries(fields).filter(([field,value]) => parseCell(value,numericFields.has(field)).error).map(([field,value]) => ({entity_id,field,value})));
  const warnings = [];
  const activeRows = Object.values(doc.calculations).flatMap(tables => tables.flatMap(table => table.result ?? [])).filter(row => !row.excluded);
  if (activeRows.some(row => row.kind === 'material' && row.price == null)) warnings.push({code:'unpriced_materials',en:'Some materials have no price and contribute zero until priced.',uk:'Деякі матеріали не мають ціни та враховуються як нуль до встановлення ціни.'});
  if (doc.normRates?.base === 0) warnings.push({code:'zero_base_rate',en:'The base hourly rate is zero.',uk:'Основна погодинна ставка дорівнює нулю.'});
  if (doc.grandTotal !== doc.computedGrandTotal) warnings.push({code:'manual_total',en:'The manual grand total differs from the computed total.',uk:'Заданий вручну підсумок відрізняється від розрахованого.'});
  const labels = { 'Assembly works': 'Арматурні роботи', 'Body works': 'Рихтувальні роботи', 'Paint works': 'Малярні роботи', 'Additional works': 'Додаткові роботи', 'Uncategorized': 'Без категорії' };
  const output = buildCalculationOutput({ ...doc, currency: doc.normRates?.currency ?? '', str: text => language === 'en' ? text : labels[text] ?? text });
  return { document: doc, missing_inputs: [...new Set(missing)], warnings, invalid_cells, processing_errors: errors, invalid_drafts: invalid, ready: missing.length === 0 && !errors.length && !invalid, output };
}
