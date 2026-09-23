/**
 * Pure, framework-free helpers for the Excel-like CSV grid in
 * `SpreadsheetEditor.jsx`. Kept separate so the tricky bits (series fill,
 * data-edge navigation, address parsing, find/replace) can be unit tested
 * with `node --test` without touching React.
 */
import Papa from "papaparse";

export const NUMERIC_RE = /^-?\d+(\.\d+)?$/;
export const isNumeric = (v) =>
  v !== "" && v != null && NUMERIC_RE.test(String(v).trim());

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// 0-indexed column number -> spreadsheet letters (0 -> "A", 26 -> "AA").
export const colLabel = (n) => {
  let s = "";
  n += 1;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

// Spreadsheet letters -> 0-indexed column number, or -1 if not a valid label.
export const colIndexFromLabel = (label) => {
  let n = 0;
  for (const ch of String(label).toUpperCase()) {
    if (ch < "A" || ch > "Z") return -1;
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
  return n - 1;
};

// Parse a "B12" or "A1:C5" address into 0-indexed { r1, r2, c1, c2 }, or null.
export const parseAddress = (input) => {
  if (!input) return null;
  const s = input.trim().toUpperCase();
  const m = s.match(/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/);
  if (!m) return null;
  const c1 = colIndexFromLabel(m[1]);
  const r1 = parseInt(m[2], 10) - 1;
  if (c1 < 0 || r1 < 0) return null;
  if (m[3] && m[4]) {
    const c2 = colIndexFromLabel(m[3]);
    const r2 = parseInt(m[4], 10) - 1;
    if (c2 < 0 || r2 < 0) return null;
    return {
      r1: Math.min(r1, r2),
      r2: Math.max(r1, r2),
      c1: Math.min(c1, c2),
      c2: Math.max(c1, c2),
    };
  }
  return { r1, r2: r1, c1, c2: c1 };
};

// Parse a CSV string into { headers: string[], rows: string[][] }.
export const parseCsv = (csv) => {
  if (!csv || !csv.trim()) {
    return { headers: ["Column A"], rows: [[""]] };
  }
  const result = Papa.parse(csv.replace(/\r\n?/g, "\n"), {
    skipEmptyLines: false,
  });
  const matrix = result.data.filter(Boolean);
  // Drop a single trailing fully-empty line produced by a final newline.
  while (
    matrix.length > 1 &&
    matrix[matrix.length - 1].every((c) => c === "" || c == null)
  ) {
    matrix.pop();
  }
  const headers = (matrix[0] || ["Column A"]).map((h, i) =>
    h == null || h === "" ? colLabel(i) : String(h),
  );
  const width = headers.length;
  const rows = matrix.slice(1).map((r) => {
    const row = new Array(width);
    for (let i = 0; i < width; i++) row[i] = r[i] == null ? "" : String(r[i]);
    return row;
  });
  if (rows.length === 0) rows.push(new Array(width).fill(""));
  return { headers, rows };
};

export const serializeCsv = (headers, rows) =>
  Papa.unparse({ fields: headers, data: rows });

// Build TSV clipboard text from a rectangular block of (view-ordered) data.
// Uses Papa so multi-line / quote-containing cells round-trip like Excel.
export const buildClipboardText = (rows, viewOrder, r1, r2, c1, c2) => {
  const data = [];
  for (let vr = r1; vr <= r2; vr++) {
    const row = rows[viewOrder[vr]] || [];
    const cells = [];
    for (let c = c1; c <= c2; c++) cells.push(row[c] == null ? "" : String(row[c]));
    data.push(cells);
  }
  return Papa.unparse(data, { delimiter: "\t", newline: "\n" });
};

// Parse pasted clipboard text (TSV / Excel) into a matrix of strings.
// Delegates quoting rules to Papa so multi-line cells copied from Excel
// (wrapped in quotes, embedded tabs/newlines) survive the round trip.
export const parseClipboard = (text) => {
  const norm = text.replace(/\r\n?/g, "\n").replace(/\n$/, "");
  if (norm === "") return [[""]];
  const result = Papa.parse(norm, {
    delimiter: "\t",
    newline: "\n",
    skipEmptyLines: false,
  });
  return result.data.length ? result.data : [[""]];
};

// Continue a value series the way Excel's fill handle does.
// `baseValues` are the known values in fill order (order they appear moving
// in the fill direction); returns an array of length `totalCount` starting
// with `baseValues`. Caller is responsible for reversing when filling
// backwards (up / left).
const TRAILING_NUM_RE = /^(.*?)(-?\d+)$/;

export const fillSeries = (baseValues, totalCount) => {
  const n = baseValues.length;
  if (n === 0 || totalCount <= n) return baseValues.slice(0, totalCount);
  const result = baseValues.slice();

  const allNumeric = baseValues.every((v) => isNumeric(v));
  if (allNumeric) {
    // A single numeric value is just copied (matches Excel's plain-drag
    // behavior); two or more continues the arithmetic progression.
    if (n === 1) {
      for (let i = n; i < totalCount; i++) result.push(baseValues[0]);
      return result;
    }
    const nums = baseValues.map(Number);
    let sum = 0;
    for (let i = 1; i < nums.length; i++) sum += nums[i] - nums[i - 1];
    const step = sum / (nums.length - 1);
    let last = nums[nums.length - 1];
    for (let i = n; i < totalCount; i++) {
      last += step;
      result.push(String(Number(last.toFixed(10))));
    }
    return result;
  }

  // Text-with-trailing-number pattern (e.g. "Item 1" -> "Item 2"). A single
  // matching value still increments (Excel recognizes this as a list).
  const matches = baseValues.map((v) => TRAILING_NUM_RE.exec(String(v)));
  if (matches.every(Boolean)) {
    const prefix = matches[0][1];
    const sameProfix = matches.every((m) => m[1] === prefix);
    if (sameProfix) {
      const nums = matches.map((m) => parseInt(m[2], 10));
      let step = 1;
      if (nums.length >= 2) {
        let sum = 0;
        for (let i = 1; i < nums.length; i++) sum += nums[i] - nums[i - 1];
        step = Math.round(sum / (nums.length - 1));
      }
      const lastMatch = matches[matches.length - 1];
      const digits = lastMatch[2].replace("-", "").length;
      let last = nums[nums.length - 1];
      for (let i = n; i < totalCount; i++) {
        last += step;
        const digitStr = String(Math.abs(last)).padStart(digits, "0");
        result.push(prefix + (last < 0 ? "-" : "") + digitStr);
      }
      return result;
    }
  }

  // Fallback: repeat the base pattern cyclically.
  for (let i = n; i < totalCount; i++) result.push(baseValues[i % n]);
  return result;
};

// Excel-style Ctrl+Arrow "jump to data edge". `getValue(r, c)` reads a cell
// in the traversal space (already view-mapped by the caller); `dr`/`dc` is
// exactly one of {-1,0,1} and the other axis 0.
export const dataEdge = (getValue, r, c, dr, dc, rowCount, colCount) => {
  const inBounds = (rr, cc) => rr >= 0 && rr < rowCount && cc >= 0 && cc < colCount;
  const isEmptyAt = (rr, cc) => {
    const v = getValue(rr, cc);
    return v === "" || v == null;
  };
  if (!inBounds(r, c) || !inBounds(r + dr, c + dc)) return { r, c };

  let pr = r;
  let pc = c;
  const startEmpty = isEmptyAt(pr, pc);
  pr += dr;
  pc += dc;

  if (startEmpty) {
    // Move until the first non-empty cell, or stop at the edge.
    while (isEmptyAt(pr, pc) && inBounds(pr + dr, pc + dc)) {
      pr += dr;
      pc += dc;
    }
    return { r: pr, c: pc };
  }

  if (isEmptyAt(pr, pc)) {
    // Gap right after a filled cell: skip empties to the next filled cell.
    while (isEmptyAt(pr, pc) && inBounds(pr + dr, pc + dc)) {
      pr += dr;
      pc += dc;
    }
    return { r: pr, c: pc };
  }

  // Inside a run of data: advance while the next cell is still filled.
  while (inBounds(pr + dr, pc + dc) && !isEmptyAt(pr + dr, pc + dc)) {
    pr += dr;
    pc += dc;
  }
  return { r: pr, c: pc };
};

// Indices (into `rows`) of rows that duplicate an earlier row exactly,
// keeping the first occurrence.
export const findDuplicateRows = (rows) => {
  const seen = new Set();
  const duplicates = [];
  rows.forEach((row, i) => {
    const key = row.map((c) => (c == null ? "" : String(c))).join("\u0001");
    if (seen.has(key)) duplicates.push(i);
    else seen.add(key);
  });
  return duplicates;
};

// Count/sum/min/max/average inputs for a view-coordinate rectangle.
export const selectionStats = (rows, viewOrder, r1, r2, c1, c2, limit = Infinity) => {
  const total = (r2 - r1 + 1) * (c2 - c1 + 1);
  if (total > limit) return { total, count: null };
  let count = 0;
  let numCount = 0;
  let sum = 0;
  let min = null;
  let max = null;
  for (let vr = r1; vr <= r2; vr++) {
    const row = rows[viewOrder[vr]];
    if (!row) continue;
    for (let c = c1; c <= c2; c++) {
      const v = row[c];
      if (v !== "" && v != null) {
        count++;
        if (isNumeric(v)) {
          const num = parseFloat(v);
          numCount++;
          sum += num;
          if (min === null || num < min) min = num;
          if (max === null || num > max) max = num;
        }
      }
    }
  }
  return { total, count, numCount, sum, min, max };
};

// Row-major matches over the current view, for Find & Replace navigation.
export const findMatches = (rows, viewOrder, colCount, query, opts = {}) => {
  if (!query) return [];
  const { matchCase = false, wholeCell = false } = opts;
  const q = matchCase ? query : query.toLowerCase();
  const matches = [];
  for (let vr = 0; vr < viewOrder.length; vr++) {
    const row = rows[viewOrder[vr]] || [];
    for (let c = 0; c < colCount; c++) {
      const raw = row[c] == null ? "" : String(row[c]);
      const cell = matchCase ? raw : raw.toLowerCase();
      const isMatch = wholeCell ? cell === q : cell.includes(q);
      if (isMatch) matches.push({ vr, c });
    }
  }
  return matches;
};

// Excel behavior for Enter/Tab when a multi-cell block is selected: the
// active cell cycles inside the block (row-major for Tab, column-major for
// Enter) instead of moving the whole selection. `axis` is "row" (Enter,
// advances down the column, wrapping to the next column) or "col" (Tab,
// advances across the row, wrapping to the next row). `reverse` is
// Shift+Enter / Shift+Tab.
export const advanceActiveInBlock = (rect, active, axis, reverse) => {
  const { r1, r2, c1, c2 } = rect;
  let { r, c } = active;
  if (axis === "row") {
    if (!reverse) {
      r += 1;
      if (r > r2) {
        r = r1;
        c = c + 1 > c2 ? c1 : c + 1;
      }
    } else {
      r -= 1;
      if (r < r1) {
        r = r2;
        c = c - 1 < c1 ? c2 : c - 1;
      }
    }
  } else {
    if (!reverse) {
      c += 1;
      if (c > c2) {
        c = c1;
        r = r + 1 > r2 ? r1 : r + 1;
      }
    } else {
      c -= 1;
      if (c < c1) {
        c = c2;
        r = r - 1 < r1 ? r2 : r - 1;
      }
    }
  }
  return { r, c };
};

// Rough column width from its longest visible value (avoids a DOM measure
// pass on every keystroke — good enough for "auto-fit" on cheap phones).
export const estimateColumnWidth = (
  values,
  { charWidth = 7, padding = 24, min = 48, max = 400 } = {},
) => {
  let maxLen = 0;
  for (const v of values) {
    const len = v == null ? 0 : String(v).length;
    if (len > maxLen) maxLen = len;
  }
  return clamp(Math.round(maxLen * charWidth + padding), min, max);
};

// Fill-handle drag: extend the source rectangle along whichever axis the
// pointer moved furthest on (Excel only ever fills in one direction per
// drag). Returns null when the target is inside the source (no-op drag), or
// `{ r1, r2, c1, c2, axis, direction }` where `axis` is "row" (extends rows,
// i.e. a vertical drag) or "col" (extends columns), and `direction` is 1
// (down/right) or -1 (up/left).
export const computeFillRect = (src, target) => {
  const dRight = target.c - src.c2;
  const dLeft = src.c1 - target.c;
  const dDown = target.r - src.r2;
  const dUp = src.r1 - target.r;
  const horiz = Math.max(dRight, dLeft, 0);
  const vert = Math.max(dDown, dUp, 0);
  if (horiz === 0 && vert === 0) return null;

  let r1 = src.r1;
  let r2 = src.r2;
  let c1 = src.c1;
  let c2 = src.c2;
  let axis;
  let direction;
  if (vert >= horiz) {
    axis = "row";
    if (dDown > 0) {
      r2 = src.r2 + dDown;
      direction = 1;
    } else {
      r1 = src.r1 - dUp;
      direction = -1;
    }
  } else {
    axis = "col";
    if (dRight > 0) {
      c2 = src.c2 + dRight;
      direction = 1;
    } else {
      c1 = src.c1 - dLeft;
      direction = -1;
    }
  }
  return { r1, r2, c1, c2, axis, direction };
};

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const replaceInCell = (value, query, replacement, opts = {}) => {
  const { matchCase = false, wholeCell = false } = opts;
  const raw = value == null ? "" : String(value);
  if (!query) return raw;
  if (wholeCell) {
    const cell = matchCase ? raw : raw.toLowerCase();
    const q = matchCase ? query : query.toLowerCase();
    return cell === q ? replacement : raw;
  }
  const flags = matchCase ? "g" : "gi";
  return raw.replace(new RegExp(escapeRegExp(query), flags), replacement);
};
