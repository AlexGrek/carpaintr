import { useCallback, useEffect, useState } from "react";
import { Button, DatePicker, HStack, IconButton, Input, Loader } from "rsuite";
import ArrowBackIcon from "@rsuite/icons/ArrowBack";
import { styles } from "../layout/StageView";
import Trans from "../../localization/Trans";
import BottomStickyLayout from "../layout/BottomStickyLayout";
import SegmentedControl from "../layout/SegmentedControl";
import { EvaluationResultsTable } from "./EvaluationResultsTable";
import PrintCalculationDrawer from "../PrintCalculationDrawer";
import { Car, CircleAlert, Printer, Save, Shapes } from "lucide-react";

import { getOrFetchCompanyInfo } from "../../utils/authFetch";
import { useLocale, registerTranslations } from "../../localization/LocaleContext";
import { capitalizeFirstLetter } from "../../utils/utils";
import NotifyMessage from "../layout/NotifyMessage";
import {
  normPriceOf,
} from "../../calc/collapseTables";
import { editCell, resetCell, hasInvalidDrafts, GRAND_TOTAL_ID, partScopeId } from "../../calc/calculationDocument";
import CalculationCell from "./CalculationCell";
import NormRatesEditor from "./NormRatesEditor";
import NormRatePicker from "./NormRatePicker";
import { companyNormRates, setRateOverride } from "../../calc/normRates";
import { workCategoryLabel } from "../../calc/workCategories";
import "./TableFinalStage.css";

registerTranslations("ua", {
  Collapsed: "Згорнуто",
  Detailed: "Детально",
  "By category": "За категоріями",
  Order: "Замовлення",
  Color: "Колір",
  "Set it in Cabinet": "Задати в кабінеті",

});

const MODE_COLLAPSED = "collapsed";
const MODE_DETAILED = "detailed";
const MODE_BY_CATEGORY = "byCategory";

const toTestIdSlug = (value) =>
  value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

const formatMoney = value => value == null || value === '' ? '' : Number(String(value).replace(',', '.')).toFixed(2);

const TableCard = ({ testId, title, icon, total, currency, children }) => (
  <section
    className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
    data-testid={testId}
  >
    <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
      {icon}
      <h4 className="cfs-card-title min-w-0 flex-1">{title}</h4>
      <div className="shrink-0 text-right text-sm font-semibold tabular-nums text-slate-900">
        {formatMoney(total)}{" "}
        <span className="text-xs font-medium text-slate-400">{currency}</span>
      </div>
    </div>
    <div className="overflow-x-auto px-2 pb-3 pt-1 sm:px-3">{children}</div>
  </section>
);

const TableFinalStage = ({
  title: _title,
  index: _index,
  onMoveForward: _onMoveForward,
  onMoveBack,
  fadeOutStarted,
  children: _children,
  onMoveTo: _onMoveTo,
  stageData,
  setStageData,
  onUndo,
  saveDocument,
  savePending = false,
}) => {
  const [printDrawerOpen, setPrintDrawerOpen] = useState(false);
  const [categoryLayout, setCategoryLayout] = useState(null);
  const { str } = useLocale();
  const orderNumber = stageData.order?.orderNumber ?? "0";
  const orderDate = stageData.order?.orderDate ? new Date(stageData.order.orderDate) : new Date();
  const setOrderNumber = value => setStageData(prev => ({ ...prev, order: { ...prev.order, orderNumber: value } }));
  const setOrderDate = value => setStageData(prev => ({ ...prev, order: { ...prev.order, orderDate: value?.toISOString() ?? null } }));
  const saving = savePending;
  const [company, setCompany] = useState(null);
  const [companyLoaded, setCompanyLoaded] = useState(false);
  // `tableMode` supersedes the older `collapseTables` boolean, which is still
  // written (and read as the fallback) so saved calculations and the print
  // drawer keep working unchanged.
  const tableMode =
    stageData.tableMode ??
    ((stageData.collapseTables ?? true) ? MODE_COLLAPSED : MODE_DETAILED);
  const collapseTables = tableMode === MODE_COLLAPSED;
  const byCategory = tableMode === MODE_BY_CATEGORY;
  const totalTables = stageData.totalTables ?? {};
  const categoryTables = stageData.categoryTables ?? {};
  // Hold group membership while a category input has focus so moving its row
  // cannot unmount the editor midway through typing. Values still commit immediately.
  const currentRows = new Map(Object.values(categoryTables).flatMap(table => table.result.map(row => [row.id, row])));
  const visibleCategoryTables = categoryLayout ? Object.fromEntries(Object.entries(categoryLayout).map(([key, table]) => [key, { ...table, result: table.result.map(row => currentRows.get(row.id) ?? row) }])) : categoryTables;
  const onCellFocus = (_id, field) => { if (field === 'category' && byCategory) setCategoryLayout(categoryTables); };
  const onCellBlur = (_id, field) => { if (field === 'category') setCategoryLayout(null); };
  const car = stageData.car ?? {};
  const paint = stageData.paint ?? {};

  const showMessage = useCallback(
    (type, message) => {
      setN(`${str(capitalizeFirstLetter(type))} ${message}`);
    },
    [str],
  );

  const [n, setN] = useState(null);

  const currency = stageData.normRates?.currency ?? company?.pricing_preferences?.norm_price?.currency ?? "";
  // Keep the legacy fallback only if company data could not be loaded. A
  // successfully loaded company rate of 0 is valid and must remain 0.
  const normPrice = stageData.normRates?.base ?? (company ? normPriceOf(company) : 1);

  useEffect(() => {
    getOrFetchCompanyInfo()
      .then(setCompany)
      .catch(() => {})
      .finally(() => setCompanyLoaded(true));
  }, []);

  useEffect(() => {
    if (company) setStageData(prev => prev.normRates ? prev : { ...prev, normRates: companyNormRates(company) });
  }, [company, setStageData]);
  const grandTotal = stageData.grandTotal;
  const invalid = hasInvalidDrafts(stageData);
  const onCellEdit = useCallback((id, field, value) => setStageData(prev => editCell(prev, id, field, value)), [setStageData]);
  const onCellReset = useCallback((id, field) => setStageData(prev => resetCell(prev, id, field)), [setStageData]);
  const partCount = Object.keys(stageData.calculations ?? {}).length;
  const carTitle =
    [car.make, car.model].filter((v) => typeof v === "string" && v).join(" ") ||
    str(car.bodyType ?? "") ||
    str("Unknown");
  const carDetails = [
    car.make || car.model ? str(car.bodyType ?? "") : null,
    car.carClass ? `${str("Class")} ${car.carClass}` : null,
    car.year ? String(car.year) : null,
    car.licensePlate || null,
  ].filter(Boolean);

  const handleTableModeChange = useCallback(
    (value) => {
      setStageData((prev) => ({
        ...prev,
        tableMode: value,
        // Kept in sync for the print drawer and previously saved calculations.
        collapseTables: value === MODE_COLLAPSED,
      }));
    },
    [setStageData],
  );

  const handleSave = useCallback(async () => {
    if (saving) return;
    try {
      const result = await saveDocument(stageData);
      if (result.acknowledged) showMessage("success", str("Calculation saved successfully!"));
    } catch (error) {
      showMessage("error", `${str("Error saving calculation:")} ${error.message}`);
    }
  }, [saveDocument, showMessage, stageData, str, saving]);

  const modeOptions = [
    { value: MODE_COLLAPSED, label: str("Collapsed"), testId: "calc-final-mode-collapsed" },
    { value: MODE_DETAILED, label: str("Detailed"), testId: "calc-final-mode-detailed" },
    { value: MODE_BY_CATEGORY, label: str("By category"), testId: "calc-final-mode-by-category" },
  ];

  return (
    <div style={styles.sampleStage}>
      <div
        style={{ ...styles.sampleStageInner, opacity: fadeOutStarted ? 0 : 1 }}
      >
        <BottomStickyLayout
          bottomPanel={
            <HStack justifyContent="space-between">
              <IconButton
                icon={<ArrowBackIcon />}
                onClick={onMoveBack}
                color="red"
                appearance="ghost"
                data-testid="calc-final-stage-back-button"
              >
                <Trans>Back</Trans>
              </IconButton>
              <HStack spacing={8}>
                <Button
                  onClick={() => handleSave()}
                  loading={saving}
                  disabled={saving}
                  color="blue"
                  appearance="ghost"
                  startIcon={<Save size={16} />}
                  data-testid="calc-final-stage-save-button"
                >
                  <Trans>Save</Trans>
                </Button>
                <Button
                  onClick={() => setPrintDrawerOpen(true)}
                  disabled={invalid}
                  color="green"
                  appearance="primary"
                  startIcon={<Printer size={16} />}
                  data-testid="calc-final-stage-print-button"
                >
                  <Trans>Print</Trans>
                </Button>
              </HStack>
            </HStack>
          }
        >
          <div className="flex w-full flex-col gap-4 text-left">
            <NotifyMessage text={n} />
            {invalid && <NotifyMessage text={str('Fix invalid cells before generating a document')} />}
            <div className="flex gap-2 flex-wrap">{onUndo && <Button onClick={onUndo} data-testid="calc-undo">{str('Undo last change')}</Button>}
            <Button data-testid="calc-reset-all-cells" onClick={() => setStageData(prev => ({ ...prev, cellOverrides: {}, cellDrafts: {} }))}>{str('Reset all edited cells')}</Button></div>

            <div
              className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm"
              data-testid="calc-final-summary"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <Car size={22} />
                </div>
                <div className="min-w-0 leading-tight">
                  <div className="truncate text-base font-semibold text-slate-900 first-letter:uppercase">
                    {carTitle}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                    {carDetails.map((detail) => (
                      <span
                        key={detail}
                        className="inline-block rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600 first-letter:uppercase"
                      >
                        {detail}
                      </span>
                    ))}
                    {paint.color && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                        {str("Color")}: {paint.color}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="ml-auto text-right leading-tight">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {str("Total")}
                </div>
                <div
                  className="text-2xl font-bold tabular-nums text-slate-900"
                  data-testid="calc-final-grand-total"
                >
                  <CalculationCell entity={{ id: GRAND_TOTAL_ID, _overrides: Object.keys(stageData.cellOverrides?.[GRAND_TOTAL_ID] ?? {}) }} field="total" value={grandTotal}
                    drafts={stageData.cellDrafts} onEdit={onCellEdit} onReset={onCellReset} testId="calc-grand-total-input" label="Total" />
                  <span>{formatMoney(grandTotal)}</span>{" "}
                  <span className="text-sm font-medium text-slate-500">{currency}</span>
                </div>
                <div className="text-xs text-slate-400">
                  {str("Selected Parts")}: {partCount}
                  {stageData.cellOverrides?.[GRAND_TOTAL_ID]?.total && <div>{str('Calculated total')}: {formatMoney(stageData.computedGrandTotal)} {currency}</div>}
                </div>
              </div>
            </div>

            {companyLoaded && company && normPrice === 0 && (
              <div
                className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
                data-testid="calc-final-norm-price-warning"
              >
                <CircleAlert size={14} className="mt-px shrink-0" />
                <span>
                  {str("Base rate is 0. Select or configure a labor rate to price work.")}{" "}
                  <a
                    href="/app/cabinet"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold"
                    data-testid="calc-final-norm-price-settings-link"
                  >
                    {str("Set it in Cabinet")}
                  </a>
                </span>
              </div>
            )}

            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {str("Order")}
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <label className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="text-xs font-medium text-slate-600">
                    <Trans>Order number</Trans>
                  </span>
                  <Input
                    onChange={setOrderNumber}
                    value={orderNumber}
                    data-testid="calc-final-order-number-input"
                  />
                </label>
                <label className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="text-xs font-medium text-slate-600">
                    <Trans>Order date</Trans>
                  </span>
                  <DatePicker
                    format="dd.MM.yyyy"
                    oneTap
                    block
                    value={orderDate}
                    onChange={setOrderDate}
                    placeholder={str("Select date")}
                    data-testid="calc-final-order-date-input"
                  />
                </label>
              </div>
            </div>

            <NormRatesEditor currencyEditable value={stageData.normRates} testId="calc-norm-rates"
              onChange={(normRates) => setStageData((prev) => ({
                ...prev, normRates,
              }))} />
            <div data-testid="calc-final-tables-panel">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
                <div className="text-lg font-semibold text-slate-900">{str("Tables")}</div>
                <SegmentedControl
                  testId="calc-final-mode-switch"
                  ariaLabel={str("Tables")}
                  value={tableMode}
                  onChange={handleTableModeChange}
                  options={modeOptions}
                />
              </div>

              {!companyLoaded ? (
                <div className="flex justify-center py-8">
                  <Loader size="md" />
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {byCategory &&
                    Object.keys(visibleCategoryTables).map((category) => (
                      <TableCard
                        key={category}
                        testId={`calc-final-category-${category}`}
                        title={str(workCategoryLabel(category))}
                        icon={<Shapes size={16} className="shrink-0 text-slate-400" />}
                        total={categoryTables[category]?.total}
                        currency={currency}
                      >
                        <EvaluationResultsTable
                          data={[visibleCategoryTables[category]]}
                          onCellFocus={onCellFocus} onCellBlur={onCellBlur}
                          onCellEdit={onCellEdit} onCellReset={onCellReset} cellDrafts={stageData.cellDrafts}
                          currency={currency}
                          basePrice={normPrice}
                          skipIncorrect={true}
                          hideTableHeaders={true}
                          showPartColumn={true}
                        />
                      </TableCard>
                    ))}
                  {!byCategory &&
                    stageData.calculations &&
                    Object.keys(stageData.calculations).map((key) => {
                      const collapsedTable = totalTables[key];
                      const tableData =
                        collapseTables && collapsedTable
                          ? [collapsedTable]
                          : stageData.calculations[key];

                      return (
                        <TableCard
                          key={key}
                          testId={`calc-final-table-${toTestIdSlug(key)}`}
                          title={<CalculationCell entity={collapsedTable ?? { id: partScopeId(key) }} field="name" value={collapsedTable?.name ?? key}
                            drafts={stageData.cellDrafts} onEdit={onCellEdit} onReset={onCellReset} label="Part" />}
                          total={collapsedTable?.total}
                          currency={currency}
                        >
                          {!collapseTables && <div className="mb-3 flex items-center gap-2 text-sm">{str('Total')}
                            <CalculationCell entity={collapsedTable} field="total" value={collapsedTable?.total} drafts={stageData.cellDrafts} onEdit={onCellEdit} onReset={onCellReset} label="Total" />
                            {collapsedTable?._overrides?.includes('total') && <span>{str('Calculated total')}: {formatMoney(collapsedTable.computedTotal)} {currency}</span>}
                          </div>}
                          <NormRatePicker rates={stageData.normRates}
                            value={stageData.normRateOverrides?.[key]?.rateId}
                            label="Part labor rate" testId={`calc-part-rate-${key}`}
                            onChange={(id) => setStageData((prev) => {
                              const normRateOverrides = setRateOverride(prev.normRateOverrides, key, null, id);
                              return { ...prev, normRateOverrides };
                            })} />
                          <EvaluationResultsTable
                            normRates={stageData.normRates}
                            tableRateOverrides={stageData.normRateOverrides?.[key]?.tables}
                            onTableRateChange={collapseTables ? null : (table, id) => setStageData((prev) => {
                              const normRateOverrides = setRateOverride(prev.normRateOverrides, key, table, id);
                              return { ...prev, normRateOverrides };
                            })}
                            data={tableData}
                            onCellEdit={onCellEdit} onCellReset={onCellReset} cellDrafts={stageData.cellDrafts}
                            currency={currency}
                            basePrice={normPrice}
                            skipIncorrect={true}
                            hideTableHeaders={collapseTables}
                          />
                        </TableCard>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        </BottomStickyLayout>
        <PrintCalculationDrawer
          show={printDrawerOpen}
          onClose={() => setPrintDrawerOpen(false)}
          partsData={stageData.parts || []}
          calculationData={stageData.calculations || {}}
          collapseTables={collapseTables}
          totalTables={totalTables}
          currency={currency}
          categoryTables={categoryTables}
          grandTotal={grandTotal}
          orderData={{ ...stageData.order, orderNumber, orderDate }}
          onOrderChange={order => setStageData(prev => ({ ...prev, order: { ...prev.order, ...order } }))}
          carData={stageData["car"]}
          paintData={stageData["paint"]}
        />
      </div>
    </div>
  );
};

export default TableFinalStage;
