/**
 * Excel (.xlsx) export of a calculation.
 *
 * Built client-side on purpose: the fully computed, sanitized payload only
 * exists in the browser (the Rust backend receives an opaque JSON blob it
 * cannot recompute — all norm-hours come from the JS processors). Rounding and
 * explicit row inclusion are shared with the PDF path through
 * `sanitizeCalcForTemplate`, so the spreadsheet and the printed document always
 * agree.
 *
 * The sheet is deliberately flat and filterable: one header row, no merged
 * cells, an autofilter across the range. Merged cells are what make a
 * spreadsheet useless for sorting and pivoting.
 */

import ExcelJS from "exceljs";
import {
  buildCategoryTables,
  sanitizeTableEntry,
  toRealNumber,
} from "./collapseTables.js";
import { localizedCategoryLabel } from "./workCategories.js";

const HEADER_FILL = "FF1F3864";
const SUBTOTAL_FILL = "FFDCE6F1";
const GRAND_TOTAL_FILL = "FFB8CCE4";

const COLUMNS = [
  { key: "category", header: "Category", width: 22 },
  { key: "part", header: "Part", width: 30 },
  { key: "name", header: "Work / Material", width: 52 },
  { key: "estimation", header: "Norm-hours", width: 13, numeric: true },
  { key: "unit", header: "Unit", width: 8 },
  { key: "price", header: "Price", width: 12, numeric: true },
  { key: "sum", header: "Sum", width: 14, numeric: true },
  { key: "tooltip", header: "Tooltip", width: 40 },
  { key: "orderingNum", header: "Ordering", width: 12, numeric: true },
];

/**
 * Flatten the by-category grouping into spreadsheet rows, applying the same
 * sanitization (resolved sums, totals, and explicit row inclusion) as the document payload.
 *
 * @param {Record<string, Array>} calculations - stageData.calculations
 * @param {number} [basePrice=1]
 * @returns {{ groups: Array<{category: string, rows: Array, total: number}>, grandTotal: number }}
 */
export function buildExcelRows(calculations, basePrice = 1, resolved = {}) {
  const byCategory = resolved.categoryTables ?? buildCategoryTables(calculations, basePrice);

  const groups = Object.entries(byCategory)
    .map(([category, table]) => {
      const sanitized = sanitizeTableEntry(table, basePrice);
      return {
        category,
        rows: sanitized.result,
        total: sanitized.total,
        computedTotal: table.computedTotal,
      };
    })
    // Empty categories without an authored subtotal need no sheet rows.
    .filter((group) => group.rows.length > 0 || group.total !== 0);

  const grandTotal = resolved.grandTotal !== undefined
    ? resolved.grandTotal
    : groups.reduce((acc, group) => acc + toRealNumber(group.total), 0);

  return { groups, grandTotal };
}

function styleHeaderRow(row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: HEADER_FILL },
  };
  row.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  row.height = 24;
}

function styleTotalRow(row, fillArgb) {
  row.font = { bold: true };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: fillArgb },
  };
}

/**
 * Build the workbook for a calculation.
 *
 * @param {object} options
 * @param {Record<string, Array>} options.calculations - stageData.calculations
 * @param {number} [options.basePrice=1]
 * @param {string} [options.currency=""] - shown in the Price/Sum headers
 * @param {(s: string) => string} [options.str] - localization function
 * @returns {Promise<ExcelJS.Workbook>}
 */
export async function buildCalculationWorkbook({
  calculations,
  basePrice = 1,
  currency = "",
  categoryTables,
  totalTables,
  grandTotal: resolvedGrandTotal,
  str = (s) => s,
}) {
  const { groups, grandTotal } = buildExcelRows(calculations, basePrice, {
    categoryTables, grandTotal: resolvedGrandTotal,
  });

  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date();
  const sheet = workbook.addWorksheet(str("Calculation"), {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = COLUMNS.map((col) => ({
    key: col.key,
    width: col.width,
  }));

  const headerRow = sheet.addRow(
    COLUMNS.map((col) =>
      ["price", "sum"].includes(col.key) && currency
        ? `${str(col.header)} (${currency})`
        : str(col.header),
    ),
  );
  styleHeaderRow(headerRow);

  for (const group of groups) {
    const categoryLabel = localizedCategoryLabel(group.category, str);

    for (const row of group.rows) {
      const dataRow = sheet.addRow([
        row.category === "" ? "" :
          localizedCategoryLabel(row.category, str) ?? categoryLabel,
        row.part ?? "",
        row.name ?? "",
        row.estimation == null || row.estimation === "" ? "" : toRealNumber(row.estimation),
        row.unit ?? "",
        row.price == null || row.price === "" ? "" : toRealNumber(row.price),
        row.sum == null || row.sum === "" ? "" : toRealNumber(row.sum),
        row.tooltip ?? "",
        row.orderingNum ?? "",
      ]);
      dataRow.getCell(4).numFmt = "0.00";
      dataRow.getCell(6).numFmt = "0.00";
      dataRow.getCell(7).numFmt = "0.00";
    }

    const subtotalRow = sheet.addRow([
      categoryLabel,
      "",
      str("Subtotal"),
      "",
      "",
      "",
      group.total,
    ]);
    subtotalRow.getCell(7).numFmt = "0.00";
    styleTotalRow(subtotalRow, SUBTOTAL_FILL);
    if (group.computedTotal != null && group.computedTotal !== group.total) {
      subtotalRow.getCell(7).note = `${str("Computed subtotal")}: ${group.computedTotal}; ${str("Difference")}: ${toRealNumber(group.total) - group.computedTotal}`;
    }
  }

  const grandTotalRow = sheet.addRow([
    "",
    "",
    str("Grand total"),
    "",
    "",
    "",
    grandTotal,
  ]);
  grandTotalRow.getCell(7).numFmt = "0.00";
  styleTotalRow(grandTotalRow, GRAND_TOTAL_FILL);
  if (totalTables) {
    const partSheet = workbook.addWorksheet(str("Part totals"));
    partSheet.columns = [{ key: "part", width: 35 }, { key: "total", width: 20 }, { key: "computed", width: 20 }, { key: "difference", width: 20 }];
    styleHeaderRow(partSheet.addRow([str("Part"), `${str("Sum")}${currency ? ` (${currency})` : ""}`, str("Computed subtotal"), str("Difference")]));
    for (const [part, table] of Object.entries(totalTables)) {
      const computed = table.computedTotal ?? table.total;
      const row = partSheet.addRow([table.name ?? part, table.total ?? "", computed ?? "", toRealNumber(table.total) - toRealNumber(computed)]);
      for (const column of [2, 3, 4]) row.getCell(column).numFmt = "0.00";
    }
    const computedGrand = Object.values(totalTables).reduce((sum, table) => sum + toRealNumber(table.total), 0);
    if (computedGrand !== grandTotal) grandTotalRow.getCell(7).note = `${str("Computed subtotal")}: ${computedGrand}; ${str("Difference")}: ${toRealNumber(grandTotal) - computedGrand}`;
  }

  // Autofilter over the header plus every data row (the grand total is left
  // out so it does not get swept up by a filter).
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, sheet.rowCount - 1), column: COLUMNS.length },
  };

  return workbook;
}

/**
 * Build the workbook and hand it to the browser as a download.
 *
 * @param {object} options - see `buildCalculationWorkbook`
 * @param {string} [options.fileName]
 * @returns {Promise<void>}
 */
export async function downloadCalculationExcel({
  fileName = `calculation_${Date.now()}.xlsx`,
  ...options
}) {
  const workbook = await buildCalculationWorkbook(options);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
