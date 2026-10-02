export function buildProcessorContext(document, part, tables, files = {}, companyPricing = {}) {
  return {
    repairAction: part.selectedAction || part.action || null,
    carPart: part,
    carClass: document.car?.carClass ?? '',
    carBodyType: document.car?.bodyType ?? '',
    carYear: Number(document.car?.year) || null,
    carModel: document.car?.model ?? '',
    paint: document.paint?.color ?? '',
    files,
    tableData: Object.fromEntries(tables.map(table => [table.name, table.data == null ? null : { ...table.data, ...document.inputOverrides?.[part.name]?.[table.name] }])),
    pricing: { ...companyPricing,
      norm_price: { amount: document.normRates?.base ?? companyPricing.norm_price?.amount ?? 0, currency: document.normRates?.currency ?? companyPricing.norm_price?.currency },
      norm_rates: document.normRates?.additional ?? [], quality: document.parts?.repairQuality ?? '', paintType: document.paint?.paintType ?? '',
    },
  };
}
