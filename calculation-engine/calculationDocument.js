import { buildCategoryTables, buildTotalTables, isMaterialRow, isValidTableEntry, sortWorkRows, toRealNumber } from './collapseTables.js';
import { BASE_RATE_ID, rateAmount } from './normRates.js';

export const SCHEMA_VERSION = 2;
export const hasCell = (overrides, id, field) => Object.hasOwn(overrides?.[id] ?? {}, field);
export const entityId = (kind, ...keys) => `${kind}:${keys.map(encodeURIComponent).join(':')}`;
export const partId = (part) => part.id ?? entityId('part', part.name);
export const partScopeId = (name) => entityId('part-total', name);
export const categoryScopeId = (name) => entityId('category-total', name);
export const GRAND_TOTAL_ID = 'grand-total';
export const numericFields = new Set(['estimation', 'price', 'sum', 'total', 'orderingNum']);
export function parseCell(value, numeric = false) {
  if (!numeric) return { value: typeof value === 'boolean' ? value : String(value ?? '') };
  const text = String(value ?? '').trim().replace(',', '.');
  if (!text) return { value: null };
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) return { error: 'Enter a finite number' };
  const number = Number(text);
  return Number.isFinite(number) ? { value: number } : { error: 'Enter a finite number' };
}
// Decimal coefficients keep currency multiplication and addition deterministic.
const decimal = value => {
  const text = String(toRealNumber(value)).toLowerCase();
  const [mantissa, exponent = '0'] = text.split('e');
  const fraction = mantissa.split('.')[1]?.length ?? 0;
  const coefficient = BigInt(mantissa.replace('.', ''));
  const scale = fraction - Number(exponent);
  return scale < 0 ? [coefficient * 10n ** BigInt(-scale), 0] : [coefficient, scale];
};
const roundedMoney = (coefficient, scale) => {
  if (scale <= 2) return Number(coefficient * 10n ** BigInt(2 - scale)) / 100;
  const divisor = 10n ** BigInt(scale - 2);
  const sign = coefficient < 0n ? -1n : 1n;
  const absolute = coefficient * sign;
  return Number(sign * ((absolute + divisor / 2n) / divisor)) / 100;
};
export const money = value => roundedMoney(...decimal(value));
export const multiplyMoney = (a, b) => {
  const [x, sx] = decimal(a), [y, sy] = decimal(b);
  return roundedMoney(x * y, sx + sy);
};
export const sumMoney = values => {
  const decimals = values.map(decimal);
  const scale = Math.max(2, ...decimals.map(([, scale]) => scale));
  return roundedMoney(decimals.reduce((sum, [coefficient, places]) => sum + coefficient * 10n ** BigInt(scale - places), 0n), scale);
};
const valueOf = (overrides, id, field, fallback) => hasCell(overrides, id, field) ? overrides[id][field].value : fallback;
const traceOrigin = row => row.trace ? `${row.trace.table}/${row.trace.field}` : null;
const origin = (row) => row.key ?? row.originKey ?? (row.trace ? `${row.trace.table}/${row.trace.field}` : row.name ?? 'row');

export function identifyTables(name, tables) {
  const tableCounts = new Map();
  return (Array.isArray(tables) ? tables : []).map((table) => {
    if (!isValidTableEntry(table)) return table;
    const source = table.processorId ?? table.id ?? table.name ?? 'table';
    const occurrence = tableCounts.get(source) ?? 0;
    tableCounts.set(source, occurrence + 1);
    const id = table.id ?? entityId('table', name, source, occurrence);
    const rowCounts = new Map();
    return { ...table, id, result: table.result.filter(Boolean).map((row) => {
      const key = origin(row);
      const occurrence = rowCounts.get(key) ?? 0;
      rowCounts.set(key, occurrence + 1);
      return { ...row, originKey: key, id: row.id ?? entityId('row', id, key, occurrence) };
    }) };
  });
}

export function migrateDocument(raw = {}) {
  if (raw.car && Object.hasOwn(raw.car, 'VIN')) {
    const { VIN, ...car } = raw.car;
    raw = { ...raw, car: { ...car, vin: car.vin ?? VIN } };
  }
  if (raw.schemaVersion === SCHEMA_VERSION && raw.generatedCalculations) {
    const complete = raw.cellOverrides && raw.cellDrafts && raw.processing && raw.inactiveCalculations && raw.inputOverrides && raw.sourceSnapshot && Object.values(raw.generatedCalculations).every(tables => tables.every(table => !isValidTableEntry(table) || table.id && table.result.every(row => row.id)));
    if (complete) return raw;
    return { cellOverrides: {}, cellDrafts: {}, processing: {}, inactiveCalculations: {}, inputOverrides: {}, sourceSnapshot: {}, revision: 0, ...raw,
      generatedCalculations: Object.fromEntries(Object.entries(raw.generatedCalculations).map(([name,tables]) => [name, identifyTables(name,tables)])) };
  }
  const generatedCalculations = Object.fromEntries(Object.entries(raw.calculations ?? raw.parts?.calculations ?? {}).map(([name, tables]) => [name, identifyTables(name, tables)]));
  const cellOverrides = { ...raw.cellOverrides };
  for (const tables of Object.values(generatedCalculations)) for (const table of tables) {
    if (!isValidTableEntry(table)) continue;
    for (const row of table.result) {
      // Unknown legacy edit history: keep the saved cells when processing is refreshed.
      const fields = ['name', 'estimation', 'unit', 'tooltip', 'category', 'orderingNum'];
      if (Object.hasOwn(row, 'price') && row.priceSource !== 'norm' && row.priceSource !== 'processor') fields.push('price');
      if (Object.hasOwn(row, 'sum') && row.priceSource !== 'norm' && row.priceSource !== 'processor') fields.push('sum');
      cellOverrides[row.id] = { ...cellOverrides[row.id], ...Object.fromEntries(fields.filter((field) => Object.hasOwn(row, field)).map((field) => [field, { kind: 'literal', value: row[field] }])) };
    }
    if (Object.hasOwn(table, 'total') && table.result.some(row => !row.priceSource)) cellOverrides[table.id] = { ...cellOverrides[table.id], total: { kind: 'literal', value: table.total } };
  }
  const normRateOverrides = Object.fromEntries(Object.entries(raw.normRateOverrides ?? {}).map(([name, selection]) => {
    const tables = { ...selection.tables };
    for (const table of generatedCalculations[name] ?? []) {
      if (Object.hasOwn(tables, table.name) && generatedCalculations[name].filter(candidate => candidate.name === table.name).length === 1) {
        tables[table.id] ??= tables[table.name]; delete tables[table.name];
      }
    }
    return [name, { ...selection, tables }];
  }));
  const { calculations: _legacy, ...parts } = raw.parts ?? {};
  return { ...raw, normRateOverrides, schemaVersion: SCHEMA_VERSION, revision: raw.revision ?? 0, generatedCalculations, cellOverrides, cellDrafts: raw.cellDrafts ?? {}, inactiveCalculations: raw.inactiveCalculations ?? {}, processing: raw.processing ?? {}, inputOverrides: raw.inputOverrides ?? {}, sourceSnapshot: raw.sourceSnapshot ?? {}, parts: { ...parts, selectedParts: (parts.selectedParts ?? Object.keys(generatedCalculations).map(name => ({ name }))).map(p => ({ ...p, id: partId(p) })) } };
}

export function resolveDocument(raw) {
  const document = migrateDocument(raw);
  const overrides = document.cellOverrides;
  const rates = document.normRates;
  const calculations = Object.fromEntries(Object.entries(document.generatedCalculations).map(([name, tables]) => [name, tables.map(table => {
    if (!isValidTableEntry(table)) return table;
    const selections = document.normRateOverrides?.[name];
    const exists = id => id === BASE_RATE_ID || rates?.additional?.some(rate => rate.id === id);
    const uniqueName = tables.filter(candidate => candidate.name === table.name).length === 1;
    const tableRate = selections?.tables?.[table.id] ?? (uniqueName ? selections?.tables?.[table.name] : undefined);
    const id = exists(tableRate) ? tableRate : exists(selections?.rateId) ? selections.rateId : BASE_RATE_ID;
    const result = table.result.map(row => {
      const effective = { ...row, ...Object.fromEntries(Object.entries(overrides[row.id] ?? {}).map(([field, literal]) => [field, literal.value])) };
      if (!hasCell(overrides, row.id, 'price')) {
        if (isMaterialRow(row)) effective.price = row.price ?? null;
        else if (row.priceSource === 'processor' || (row.price != null && row.priceSource !== 'norm')) effective.price = row.price;
        else effective.price = rates ? rateAmount(rates, id) : (row.price ?? 0);
      }
      effective.kind = row.kind ?? (isMaterialRow(row) ? 'material' : 'labor');
      effective.sum = hasCell(overrides, row.id, 'sum') ? valueOf(overrides, row.id, 'sum') : multiplyMoney(effective.estimation, effective.price);
      effective._explicitSum = true;
      effective.normRateId = id;
      effective._overrides = Object.keys(overrides[row.id] ?? {});
      return effective;
    });
    const computedTotal = sumMoney(result.filter(row => !row.excluded).map(row => row.sum));
    return { ...table, ...Object.fromEntries(Object.entries(overrides[table.id] ?? {}).map(([field, literal]) => [field, literal.value])), result: sortWorkRows(result), computedTotal, total: valueOf(overrides, table.id, 'total', computedTotal), _explicitTotal: true, _overrides: Object.keys(overrides[table.id] ?? {}) };
  })]));
  const totalTables = buildTotalTables(calculations);
  for (const [name, table] of Object.entries(totalTables)) {
    const id = partScopeId(name);
    table.id = id;
    table.computedTotal = sumMoney(calculations[name].filter(isValidTableEntry).map(table => table.total));
    table.total = valueOf(overrides, id, 'total', table.computedTotal);
    table.name = valueOf(overrides, id, 'name', name);
    table._explicitTotal = true;
    table._overrides = Object.keys(overrides[id] ?? {});
    table.result = table.result.map(row => ({ ...row, part: table.name }));
  }
  const categoryTables = buildCategoryTables(calculations);
  for (const [category, table] of Object.entries(categoryTables)) {
    const id = categoryScopeId(category);
    table.id = id;
    table.computedTotal = sumMoney(table.result.filter(row => !row.excluded).map(row => row.sum));
    table.total = valueOf(overrides, id, 'total', table.computedTotal);
    table._explicitTotal = true;
    table._overrides = Object.keys(overrides[id] ?? {});
    table.result = table.result.map(row => ({ ...row, _partKey: row.part, _partOverrides: totalTables[row.part]?._overrides, part: totalTables[row.part]?.name ?? row.part }));
  }
  const computedGrandTotal = sumMoney(Object.values(totalTables).map(table => table.total));
  const grandTotal = valueOf(overrides, GRAND_TOTAL_ID, 'total', computedGrandTotal);
  return { ...document, calculations, totalTables, categoryTables, grandTotal, computedGrandTotal };
}

export function editCell(document, id, field, text) {
  const parsed = parseCell(text, numericFields.has(field));
  const cellDrafts = typeof text === 'boolean' ? document.cellDrafts : { ...document.cellDrafts, [id]: { ...document.cellDrafts?.[id], [field]: String(text ?? '') } };
  if (parsed.error) return { ...document, cellDrafts };
  return { ...document, cellDrafts, cellOverrides: { ...document.cellOverrides, [id]: { ...document.cellOverrides?.[id], [field]: { kind: 'literal', value: parsed.value } } } };
}
export function resetCell(document, id, field) {
  const fields = { ...document.cellOverrides?.[id] }; delete fields[field];
  const drafts = { ...document.cellDrafts?.[id] }; delete drafts[field];
  return { ...document, cellOverrides: { ...document.cellOverrides, [id]: fields }, cellDrafts: { ...document.cellDrafts, [id]: drafts } };
}
export function hasInvalidDrafts(document) {
  if (Object.values(document.calculations ?? {}).some(tables => tables.some(table => table.result?.some(row => !row.excluded && row.sum != null && parseCell(row.sum, true).error)))) return true;
  const active = new Set([GRAND_TOTAL_ID, ...Object.values(document.totalTables ?? {}).map(t => t.id), ...Object.values(document.categoryTables ?? {}).map(t => t.id), ...Object.values(document.calculations ?? {}).flatMap(tables => tables.flatMap(t => [t.id, ...(t.result ?? []).filter(r => !r.excluded).map(r => r.id)]))]);
  return Object.entries(document.cellDrafts ?? {}).filter(([id]) => active.has(id)).some(([, fields]) => Object.entries(fields).some(([field, text]) => parseCell(text, numericFields.has(field)).error));
}

export function selectParts(document, selectedParts) {
  const generatedCalculations = { ...document.generatedCalculations };
  const inactiveCalculations = { ...document.inactiveCalculations };
  const inactiveParts = { ...document.inactiveParts };
  const names = new Set(selectedParts.map(p => p.name));
  for (const part of document.parts?.selectedParts ?? []) if (!names.has(part.name)) inactiveParts[part.name] = part;
  selectedParts = selectedParts.map(part => !document.parts?.selectedParts?.some(p => p.name === part.name) && inactiveParts[part.name] ? { ...inactiveParts[part.name], ...part, action: part.action || inactiveParts[part.name].action, selectedAction: part.selectedAction || inactiveParts[part.name].selectedAction } : part);
  for (const name of Object.keys(generatedCalculations)) if (!names.has(name)) {
    inactiveCalculations[name] = generatedCalculations[name]; delete generatedCalculations[name];
  }
  for (const name of names) if (!generatedCalculations[name] && inactiveCalculations[name]) {
    generatedCalculations[name] = inactiveCalculations[name]; delete inactiveCalculations[name];
  }
  return { ...document, generatedCalculations, inactiveCalculations, inactiveParts, parts: { ...document.parts, selectedParts: selectedParts.map(p => ({ ...p, id: partId(p) })) } };
}
export const processingFingerprint = inputs => JSON.stringify(inputs);
export function applyGenerated(document, name, tables, fingerprint, errors = []) {
  const identified = identifyTables(name, tables);
  const old = document.generatedCalculations[name] ?? [];
  const archived = document.historicalTables?.[name] ?? [];
  const candidates = [...old, ...archived];
  const reconciled = identified.map(table => {
    const source = candidate => candidate.processorId ?? candidate.name;
    const ambiguous = !tables[identified.indexOf(table)]?.id && identified.filter(candidate => source(candidate) === source(table)).length > 1;
    if (ambiguous) {
      const id = entityId('unmatched-table', name, source(table), crypto.randomUUID());
      return { ...table, id, result: table.result.map(row => ({ ...row, id: entityId('row', id, origin(row), crypto.randomUUID()) })) };
    }
    const exactId = candidates.find(t => t.id === table.id);
    const byProcessor = table.processorId ? candidates.filter(t => t.processorId === table.processorId) : [];
    const exact = exactId ?? (new Set(byProcessor.map(t => t.id)).size === 1 ? byProcessor[0] : null);
    const byName = candidates.filter(t => t.name === table.name);
    const previous = exact ?? (new Set(byName.map(t => t.id)).size === 1 ? byName[0] : null);
    if (!previous?.result) return table;
    const pool = [...previous.result, ...archived.filter(t => t.id === previous.id).flatMap(t => t.result ?? []), ...(document.inactiveRows?.[name] ?? []).filter(row => row.tableId === previous.id)]
      .filter((row, index, rows) => rows.findIndex(other => other.id === row.id) === index);
    const counts = rows => rows.reduce((map, row) => map.set(origin(row), (map.get(origin(row)) ?? 0) + 1), new Map());
    const before = counts(pool), after = counts(table.result);
    const result = table.result.map(row => {
      const key = origin(row);
      const direct = before.get(key) === 1 && after.get(key) === 1 ? pool.find(r => origin(r) === key) : null;
      // Explicit keys introduced by catalog migration may recover a legacy
      // source-traced row, but only when both sides have a unique source.
      const trace = traceOrigin(row);
      const legacy = trace ? pool.filter(r => traceOrigin(r) === trace && !r.key) : [];
      const match = direct ?? (legacy.length === 1 && table.result.filter(r => traceOrigin(r) === trace).length === 1 ? legacy[0] : null);
      return { ...row, id: match?.id ?? (before.get(key) > 1 ? entityId('unmatched-row', previous.id, key, document.revision ?? 0, crypto.randomUUID()) : row.id) };
    });
    const manualRows = previous.result.filter(row => row.manualRow && !result.some(r => r.id === row.id));
    return { ...table, id: previous.id, result: [...result, ...manualRows] };
  });
  const currentIds = new Set(reconciled.flatMap(t => t.result?.map(r => r.id) ?? []));
  const orphaned = old.flatMap(t => (t.result ?? []).filter(r => !currentIds.has(r.id) && Object.keys(document.cellOverrides[r.id] ?? {}).length).map(row => ({ ...row, tableId: t.id, tableName: t.name })));
  const historicalTables = [...archived, ...old].reduce((result, table) => {
    const found = result.find(t => t.id === table.id);
    if (found) found.result = [...found.result, ...table.result].filter((row, index, rows) => rows.findIndex(r => r.id === row.id) === index);
    else result.push({ ...table, result: [...(table.result ?? [])] });
    return result;
  }, []);
  return { ...document, generatedCalculations: { ...document.generatedCalculations, [name]: reconciled }, historicalTables: { ...document.historicalTables, [name]: historicalTables },
    inactiveRows: { ...document.inactiveRows, [name]: [...(document.inactiveRows?.[name] ?? []), ...orphaned].filter((row, index, rows) => !currentIds.has(row.id) && rows.findIndex(r => r.id === row.id) === index) },
    processing: { ...document.processing, [name]: { fingerprint, status: errors.length ? 'error' : 'ready', errors } } };
}
export function restoreInactiveRow(document, name, id) {
  const row = document.inactiveRows?.[name]?.find(row => row.id === id);
  if (!row) return document;
  const tables = [...(document.generatedCalculations[name] ?? [])];
  const index = tables.findIndex(table => table.id === row.tableId);
  if (index >= 0) tables[index] = { ...tables[index], result: [...tables[index].result, { ...row, manualRow: true }] };
  else tables.push({ id: row.tableId, name: row.tableName, result: [{ ...row, manualRow: true }] });
  return { ...document, generatedCalculations: { ...document.generatedCalculations, [name]: tables }, inactiveRows: { ...document.inactiveRows, [name]: document.inactiveRows[name].filter(row => row.id !== id) } };
}
export function patchDocument(previous, update) {
  const next = typeof update === 'function' ? update(previous) : { ...previous, ...update };
  if (next === previous) return previous;
  return resolveDocument({ ...next, revision: (previous.revision ?? 0) + 1 });
}
