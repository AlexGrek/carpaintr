import { useCallback, useEffect, useState } from "react";
import { Button, DatePicker, HStack, IconButton, Input, Loader } from "rsuite";
import ArrowBackIcon from "@rsuite/icons/ArrowBack";
import { styles } from "../layout/StageView";
import Trans from "../../localization/Trans";
import BottomStickyLayout from "../layout/BottomStickyLayout";
import SegmentedControl from "../layout/SegmentedControl";
import { EvaluationResultsTable } from "./EvaluationResultsTable";
import PrintCalculationDrawer from "../PrintCalculationDrawer";
import { Car, CircleAlert, Lock, Printer, Save, Shapes } from "lucide-react";
import { cloneDeep, isEqual } from "lodash";
import { authFetch, getOrFetchCompanyInfo } from "../../utils/authFetch";
import { useLocale, registerTranslations } from "../../localization/LocaleContext";
import { capitalizeFirstLetter } from "../../utils/utils";
import NotifyMessage from "../layout/NotifyMessage";
import {
  buildTotalTables,
  buildCategoryTables,
  calculationsWithDefaultPrices,
  hasNormPrice,
  normPriceOf,
} from "../../calc/collapseTables";
import { WORK_CATEGORY_LABELS } from "../../calc/workCategories";
import "./TableFinalStage.css";

registerTranslations("ua", {
  Collapsed: "Згорнуто",
  Detailed: "Детально",
  "By category": "За категоріями",
  Order: "Замовлення",
  Color: "Колір",
  "Norm price is not set, so prices default to 1.":
    "Ціну нормогодини не задано, тому ціни рахуються як 1.",
  "Set it in Cabinet": "Задати в кабінеті",
  "Collapsed view is read-only. Switch to Detailed to edit individual table rows.":
    "Згорнутий вигляд лише для перегляду. Перейдіть до «Детально», щоб редагувати рядки.",
  "Category view is read-only. Switch to Detailed to edit individual table rows.":
    "Перегляд за категоріями доступний лише для читання. Перейдіть до «Детально», щоб редагувати рядки.",
});

const MODE_COLLAPSED = "collapsed";
const MODE_DETAILED = "detailed";
const MODE_BY_CATEGORY = "byCategory";

const toTestIdSlug = (value) =>
  value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

const formatMoney = (value) => (Number.isFinite(value) ? value : 0).toFixed(2);

const ReadOnlyNote = ({ testId, children }) => (
  <div
    className="mb-3 flex items-start gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-600"
    data-testid={testId}
  >
    <Lock size={14} className="mt-px shrink-0 text-slate-400" />
    <span>{children}</span>
  </div>
);

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
}) => {
  const [printDrawerOpen, setPrintDrawerOpen] = useState(false);
  const { str } = useLocale();
  const [orderNumber, setOrderNumber] = useState("0");
  const [orderDate, setOrderDate] = useState(new Date());
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
  const car = stageData.car ?? {};
  const paint = stageData.paint ?? {};

  const showMessage = useCallback(
    (type, message) => {
      setN(`${str(capitalizeFirstLetter(type))} ${message}`);
    },
    [str],
  );

  const [n, setN] = useState(null);

  const currency = company?.pricing_preferences?.norm_price?.currency ?? "";
  const normPrice = normPriceOf(company);

  useEffect(() => {
    getOrFetchCompanyInfo()
      .then(setCompany)
      .catch(() => {})
      .finally(() => setCompanyLoaded(true));
  }, []);

  // Rows only carry a price if they were priced on the parts stage; older saved
  // calculations may not be, so price them here before anything sums or prints.
  useEffect(() => {
    if (!companyLoaded || !stageData.calculations) return;
    setStageData((prev) => {
      const priced = calculationsWithDefaultPrices(prev.calculations, normPrice);
      return priced === prev.calculations ? prev : { ...prev, calculations: priced };
    });
  }, [companyLoaded, normPrice, stageData.calculations, setStageData]);

  useEffect(() => {
    if (!stageData.calculations) return;
    const nextTotals = buildTotalTables(stageData.calculations, normPrice);
    const nextCategories = buildCategoryTables(stageData.calculations, normPrice);
    setStageData((prev) => {
      if (
        isEqual(prev.totalTables, nextTotals) &&
        isEqual(prev.categoryTables, nextCategories)
      ) {
        return prev;
      }
      return {
        ...prev,
        totalTables: nextTotals,
        categoryTables: nextCategories,
      };
    });
  }, [stageData.calculations, normPrice, setStageData]);

  const grandTotal = Object.values(totalTables).reduce(
    (acc, table) => acc + (Number.isFinite(table?.total) ? table.total : 0),
    0,
  );

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
        totalTables: buildTotalTables(prev.calculations || {}, normPrice),
        categoryTables: buildCategoryTables(prev.calculations || {}, normPrice),
      }));
    },
    [setStageData, normPrice],
  );

  const handleSave = useCallback(async () => {
    const dataToSave = cloneDeep(stageData);

    try {
      const response = await authFetch("/api/v1/user/calculationstore", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(dataToSave),
      });
      if (response.ok) {
        showMessage("success", str("Calculation saved successfully!"));
        const data = await response.json();
        console.log("Got data: " + JSON.stringify(data));
        setStageData({
          ...dataToSave,
          car: { ...dataToSave.car, storeFileName: data.saved_file_path },
        });
      } else {
        const errorData = await response.json();
        showMessage(
          "error",
          `${str("Failed to save calculation:")} ${errorData.message || response.statusText}`,
        );
      }
    } catch (error) {
      console.error("Error saving calculation:", error);
      showMessage(
        "error",
        `${str("Error saving calculation:")} ${error.message}`,
      );
    }
  }, [setStageData, showMessage, stageData, str]);

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
                  color="blue"
                  appearance="ghost"
                  startIcon={<Save size={16} />}
                  data-testid="calc-final-stage-save-button"
                >
                  <Trans>Save</Trans>
                </Button>
                <Button
                  onClick={() => setPrintDrawerOpen(true)}
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
                  {formatMoney(grandTotal)}{" "}
                  <span className="text-sm font-medium text-slate-500">{currency}</span>
                </div>
                <div className="text-xs text-slate-400">
                  {str("Selected Parts")}: {partCount}
                </div>
              </div>
            </div>

            {companyLoaded && company && !hasNormPrice(company) && (
              <div
                className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
                data-testid="calc-final-norm-price-warning"
              >
                <CircleAlert size={14} className="mt-px shrink-0" />
                <span>
                  {str("Norm price is not set, so prices default to 1.")}{" "}
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

              {collapseTables && (
                <ReadOnlyNote testId="calc-final-collapse-readonly-note">
                  {str("Collapsed view is read-only. Switch to Detailed to edit individual table rows.")}
                </ReadOnlyNote>
              )}
              {byCategory && (
                <ReadOnlyNote testId="calc-final-category-readonly-note">
                  {str("Category view is read-only. Switch to Detailed to edit individual table rows.")}
                </ReadOnlyNote>
              )}

              {!companyLoaded ? (
                <div className="flex justify-center py-8">
                  <Loader size="md" />
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {byCategory &&
                    Object.keys(categoryTables).map((category) => (
                      <TableCard
                        key={category}
                        testId={`calc-final-category-${category}`}
                        title={str(WORK_CATEGORY_LABELS[category] ?? category)}
                        icon={<Shapes size={16} className="shrink-0 text-slate-400" />}
                        total={categoryTables[category]?.total}
                        currency={currency}
                      >
                        <EvaluationResultsTable
                          data={[categoryTables[category]]}
                          setData={null}
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
                          title={key}
                          total={collapsedTable?.total}
                          currency={currency}
                        >
                          <EvaluationResultsTable
                            data={tableData}
                            setData={
                              collapseTables
                                ? null
                                : (value) => {
                                    setStageData({
                                      ...stageData,
                                      calculations: {
                                        ...stageData.calculations,
                                        [key]: value,
                                      },
                                    });
                                  }
                            }
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
          orderData={{ orderNumber, orderDate }}
          carData={stageData["car"]}
          paintData={stageData["paint"]}
        />
      </div>
    </div>
  );
};

export default TableFinalStage;
