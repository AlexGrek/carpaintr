import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Papa from "papaparse";
import { Drawer, Button, Input, InputGroup, IconButton, Message, toaster } from "rsuite";
import {
  Plus,
  Trash2,
  Filter,
  Search,
  Undo2,
  Redo2,
  ArrowUp,
  ArrowDown,
  Copy,
  ClipboardPaste,
  Scissors,
  ChevronsLeftRight,
} from "lucide-react";
import {
  useLocale,
  registerTranslations,
} from "../../localization/LocaleContext";
import Trans from "../../localization/Trans";
import "./SpreadsheetEditor.css";

registerTranslations("ua", {
  "Add row": "Додати рядок",
  "Add column": "Додати колонку",
  "Delete rows": "Видалити рядки",
  "Delete columns": "Видалити колонки",
  "Insert row above": "Вставити рядок вище",
  "Insert row below": "Вставити рядок нижче",
  "Insert column left": "Вставити колонку зліва",
  "Insert column right": "Вставити колонку справа",
  Copy: "Копіювати",
  Cut: "Вирізати",
  Paste: "Вставити",
  "Clear contents": "Очистити вміст",
  Filters: "Фільтри",
  "Search all cells…": "Пошук по всіх клітинках…",
  Undo: "Скасувати",
  Redo: "Повторити",
  "Sort ascending": "Сортувати за зростанням",
  "Sort descending": "Сортувати за спаданням",
  rows: "рядків",
  columns: "колонок",
  selected: "виділено",
  cells: "клітинок",
  Sum: "Сума",
  Average: "Середнє",
  Count: "Кількість",
  "No data": "Немає даних",
  Filter: "Фільтр",
  "Edit CSV": "Редагування CSV",
  "Column name": "Назва колонки",
  "Rename column": "Перейменувати колонку",
  "Nothing to paste": "Нічого вставляти",
  "Cannot add rows while sorted or filtered":
    "Неможливо додати рядки під час сортування або фільтрування",
});

const ROW_H = 28;
const HEADER_H = 34;
const FILTER_H = 32;
const DEFAULT_COL_W = 140;
const MIN_COL_W = 48;
const OVERSCAN_Y = 8;
const OVERSCAN_X = 3;
const MAX_HISTORY = 60;
const STATS_LIMIT = 200000;

const NUMERIC_RE = /^-?\d+(\.\d+)?$/;
const isNumeric = (v) => v !== "" && v != null && NUMERIC_RE.test(String(v).trim());

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const colLabel = (n) => {
  let s = "";
  n += 1;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

// Parse a CSV string into { headers: string[], rows: string[][] }.
const parseCsv = (csv) => {
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

const serializeCsv = (headers, rows) =>
  Papa.unparse({ fields: headers, data: rows });

// Build TSV text from a rectangular block of the (view-ordered) data.
const buildClipboardText = (rows, viewOrder, r1, r2, c1, c2) => {
  const lines = [];
  for (let vr = r1; vr <= r2; vr++) {
    const row = rows[viewOrder[vr]] || [];
    const cells = [];
    for (let c = c1; c <= c2; c++) {
      let v = row[c] == null ? "" : String(row[c]);
      if (/[\t\n"]/.test(v)) v = '"' + v.replace(/"/g, '""') + '"';
      cells.push(v);
    }
    lines.push(cells.join("\t"));
  }
  return lines.join("\n");
};

// Parse pasted clipboard text (TSV / Excel) into a matrix of strings.
const parseClipboard = (text) => {
  const norm = text.replace(/\r\n?/g, "\n").replace(/\n$/, "");
  if (norm === "") return [[""]];
  return norm.split("\n").map((line) => line.split("\t"));
};

const SpreadsheetEditor = ({ open, onClose, onSave, fileName, csvData }) => {
  const { str } = useLocale();

  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [colWidths, setColWidths] = useState([]);

  const [filters, setFilters] = useState({});
  const [quickFilter, setQuickFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [sort, setSort] = useState(null); // { col, dir: 'asc' | 'desc' }

  // selection in VIEW coordinates: { anchor:{r,c}, focus:{r,c} }
  const [selection, setSelection] = useState({
    anchor: { r: 0, c: 0 },
    focus: { r: 0, c: 0 },
  });
  const [editing, setEditing] = useState(null); // { r, c }
  const [editValue, setEditValue] = useState("");
  const [renaming, setRenaming] = useState(null); // col index
  const [renameValue, setRenameValue] = useState("");

  const [copied, setCopied] = useState(null); // { r1,r2,c1,c2 } view coords
  const [contextMenu, setContextMenu] = useState(null); // { x, y }

  const [scroll, setScroll] = useState({ top: 0, left: 0 });
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  const pastRef = useRef([]);
  const futureRef = useRef([]);
  const [, forceHistory] = useState(0);

  const scrollRef = useRef(null);
  const rafRef = useRef(0);
  const dragRef = useRef(null);
  const resizeRef = useRef(null);
  const editInputRef = useRef(null);

  // ---- Load / reset when opened with new data ----
  useEffect(() => {
    if (!open) return;
    const { headers: h, rows: r } = parseCsv(csvData);
    setHeaders(h);
    setRows(r);
    setColWidths(h.map(() => DEFAULT_COL_W));
    setFilters({});
    setQuickFilter("");
    setSort(null);
    setSelection({ anchor: { r: 0, c: 0 }, focus: { r: 0, c: 0 } });
    setEditing(null);
    setCopied(null);
    pastRef.current = [];
    futureRef.current = [];
    forceHistory((n) => n + 1);
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
      scrollRef.current.scrollLeft = 0;
    }
    setScroll({ top: 0, left: 0 });
  }, [open, csvData]);

  // ---- Identity view? (needed to safely append rows) ----
  const hasFilters = useMemo(
    () => quickFilter.trim() !== "" || Object.values(filters).some((v) => v),
    [quickFilter, filters],
  );
  const identityView = !sort && !hasFilters;

  // ---- Derived view order (filter + sort), array of base row indices ----
  const viewOrder = useMemo(() => {
    let idx = rows.map((_, i) => i);
    const q = quickFilter.trim().toLowerCase();
    const colFilters = Object.entries(filters).filter(([, v]) => v);
    if (q || colFilters.length) {
      idx = idx.filter((i) => {
        const row = rows[i];
        if (q && !row.some((cell) => String(cell).toLowerCase().includes(q)))
          return false;
        for (const [c, v] of colFilters) {
          if (!String(row[c] ?? "").toLowerCase().includes(v.toLowerCase()))
            return false;
        }
        return true;
      });
    }
    if (sort) {
      const { col, dir } = sort;
      const mul = dir === "desc" ? -1 : 1;
      idx = [...idx].sort((a, b) => {
        const av = rows[a][col] ?? "";
        const bv = rows[b][col] ?? "";
        if (isNumeric(av) && isNumeric(bv))
          return (parseFloat(av) - parseFloat(bv)) * mul;
        return String(av).localeCompare(String(bv), undefined, {
          numeric: true,
        }) * mul;
      });
    }
    return idx;
  }, [rows, filters, quickFilter, sort]);

  const rowCount = viewOrder.length;
  const colCount = headers.length;

  // ---- Column offsets (prefix sums) ----
  const colOffsets = useMemo(() => {
    const offs = new Array(colCount + 1);
    offs[0] = 0;
    for (let i = 0; i < colCount; i++)
      offs[i + 1] = offs[i] + (colWidths[i] || DEFAULT_COL_W);
    return offs;
  }, [colWidths, colCount]);

  const gutterW = useMemo(
    () => Math.max(48, 20 + String(rowCount).length * 9),
    [rowCount],
  );
  const totalColW = colOffsets[colCount] || 0;
  const headerTotal = HEADER_H + (showFilters ? FILTER_H : 0);
  const canvasW = gutterW + totalColW;
  const canvasH = headerTotal + rowCount * ROW_H;

  // ---- Visible ranges ----
  const firstRow = clamp(
    Math.floor(scroll.top / ROW_H) - OVERSCAN_Y,
    0,
    Math.max(0, rowCount),
  );
  const lastRow = clamp(
    Math.ceil((scroll.top + viewport.height) / ROW_H) + OVERSCAN_Y,
    0,
    rowCount,
  );

  const findCol = useCallback(
    (x) => {
      // largest c with colOffsets[c] <= x
      let lo = 0;
      let hi = colCount;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (colOffsets[mid] <= x) lo = mid + 1;
        else hi = mid;
      }
      return clamp(lo - 1, 0, colCount - 1);
    },
    [colOffsets, colCount],
  );

  const firstCol = clamp(findCol(scroll.left - gutterW) - OVERSCAN_X, 0, colCount);
  const lastCol = clamp(
    findCol(scroll.left + viewport.width - gutterW) + 1 + OVERSCAN_X,
    0,
    colCount,
  );

  // ---- Scroll handling (rAF-throttled) ----
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      setScroll({ top: el.scrollTop, left: el.scrollLeft });
    });
  }, []);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setViewport({ width: el.clientWidth, height: el.clientHeight });
    });
    ro.observe(el);
    setViewport({ width: el.clientWidth, height: el.clientHeight });
    return () => ro.disconnect();
  }, [open]);

  // ---- History ----
  const pushHistory = useCallback(() => {
    pastRef.current.push({ headers, rows, colWidths });
    if (pastRef.current.length > MAX_HISTORY) pastRef.current.shift();
    futureRef.current = [];
    forceHistory((n) => n + 1);
  }, [headers, rows, colWidths]);

  const undo = useCallback(() => {
    if (!pastRef.current.length) return;
    const snap = pastRef.current.pop();
    futureRef.current.unshift({ headers, rows, colWidths });
    setHeaders(snap.headers);
    setRows(snap.rows);
    setColWidths(snap.colWidths);
    setEditing(null);
    forceHistory((n) => n + 1);
  }, [headers, rows, colWidths]);

  const redo = useCallback(() => {
    if (!futureRef.current.length) return;
    const snap = futureRef.current.shift();
    pastRef.current.push({ headers, rows, colWidths });
    setHeaders(snap.headers);
    setRows(snap.rows);
    setColWidths(snap.colWidths);
    setEditing(null);
    forceHistory((n) => n + 1);
  }, [headers, rows, colWidths]);

  // ---- Selection helpers ----
  const selRect = useMemo(() => {
    const { anchor, focus } = selection;
    return {
      r1: Math.min(anchor.r, focus.r),
      r2: Math.max(anchor.r, focus.r),
      c1: Math.min(anchor.c, focus.c),
      c2: Math.max(anchor.c, focus.c),
    };
  }, [selection]);

  const scrollCellIntoView = useCallback(
    (r, c) => {
      const el = scrollRef.current;
      if (!el) return;
      const cellTop = r * ROW_H;
      const cellBottom = cellTop + ROW_H;
      const viewTop = el.scrollTop;
      const usableH = el.clientHeight - headerTotal;
      if (cellTop < viewTop) el.scrollTop = cellTop;
      else if (cellBottom > viewTop + usableH)
        el.scrollTop = cellBottom - usableH;

      const cellLeft = colOffsets[c];
      const cellRight = colOffsets[c + 1];
      const viewLeft = el.scrollLeft;
      const usableW = el.clientWidth - gutterW;
      if (cellLeft < viewLeft) el.scrollLeft = cellLeft;
      else if (cellRight > viewLeft + usableW)
        el.scrollLeft = cellRight - usableW;
    },
    [colOffsets, gutterW, headerTotal],
  );

  const setFocus = useCallback(
    (r, c, extend) => {
      const nr = clamp(r, 0, Math.max(0, rowCount - 1));
      const nc = clamp(c, 0, Math.max(0, colCount - 1));
      setSelection((prev) => ({
        anchor: extend ? prev.anchor : { r: nr, c: nc },
        focus: { r: nr, c: nc },
      }));
      scrollCellIntoView(nr, nc);
    },
    [rowCount, colCount, scrollCellIntoView],
  );

  // ---- Cell mutation (grouped, minimal copies) ----
  const setCells = useCallback(
    (changes) => {
      if (!changes.length) return;
      pushHistory();
      setRows((prev) => {
        const byRow = new Map();
        for (const ch of changes) {
          if (ch.r < 0 || ch.r >= prev.length) continue;
          let arr = byRow.get(ch.r);
          if (!arr) {
            arr = prev[ch.r].slice();
            while (arr.length < colCount) arr.push("");
            byRow.set(ch.r, arr);
          }
          arr[ch.c] = ch.value;
        }
        const next = prev.slice();
        for (const [r, arr] of byRow) next[r] = arr;
        return next;
      });
    },
    [pushHistory, colCount],
  );

  // ---- Editing ----
  const startEdit = useCallback(
    (r, c, initial) => {
      const base = viewOrder[r];
      if (base == null) return;
      setEditing({ r, c });
      setEditValue(initial != null ? initial : String(rows[base][c] ?? ""));
      scrollCellIntoView(r, c);
    },
    [viewOrder, rows, scrollCellIntoView],
  );

  const commitEdit = useCallback(
    (move) => {
      if (!editing) return;
      const base = viewOrder[editing.r];
      const current = String(rows[base]?.[editing.c] ?? "");
      if (current !== editValue)
        setCells([{ r: base, c: editing.c, value: editValue }]);
      setEditing(null);
      if (move) setFocus(editing.r + move.dr, editing.c + move.dc, false);
    },
    [editing, editValue, viewOrder, rows, setCells, setFocus],
  );

  const cancelEdit = useCallback(() => setEditing(null), []);

  // Focus the edit input once mounted.
  useEffect(() => {
    if (editing && editInputRef.current) {
      const el = editInputRef.current;
      el.focus();
      const len = el.value.length;
      el.setSelectionRange(len, len);
    }
  }, [editing]);

  // ---- Clear / delete contents ----
  const clearSelection = useCallback(() => {
    const { r1, r2, c1, c2 } = selRect;
    const changes = [];
    for (let vr = r1; vr <= r2; vr++) {
      const base = viewOrder[vr];
      for (let c = c1; c <= c2; c++) changes.push({ r: base, c, value: "" });
    }
    setCells(changes);
  }, [selRect, viewOrder, setCells]);

  // ---- Clipboard ----
  const isEditingActive = useCallback(
    () =>
      editInputRef.current &&
      document.activeElement === editInputRef.current,
    [],
  );

  const doCopy = useCallback(
    (e) => {
      if (isEditingActive()) return;
      const { r1, r2, c1, c2 } = selRect;
      const text = buildClipboardText(rows, viewOrder, r1, r2, c1, c2);
      if (e?.clipboardData) {
        e.clipboardData.setData("text/plain", text);
        e.preventDefault();
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(text).catch(() => {});
      }
      setCopied({ r1, r2, c1, c2 });
    },
    [selRect, rows, viewOrder, isEditingActive],
  );

  const doCut = useCallback(
    (e) => {
      if (isEditingActive()) return;
      doCopy(e);
      clearSelection();
    },
    [doCopy, clearSelection, isEditingActive],
  );

  const applyPaste = useCallback(
    (matrix) => {
      if (!matrix.length) return;
      const { r1, c1 } = selRect;
      const pRows = matrix.length;
      const pCols = Math.max(...matrix.map((m) => m.length));
      const neededRows = r1 + pRows;
      const neededCols = c1 + pCols;

      // Extend columns if needed (columns are never filtered/sorted).
      let workingHeaders = headers;
      let workingWidths = colWidths;
      if (neededCols > colCount) {
        workingHeaders = headers.slice();
        workingWidths = colWidths.slice();
        for (let c = colCount; c < neededCols; c++) {
          workingHeaders.push(colLabel(c));
          workingWidths.push(DEFAULT_COL_W);
        }
      }

      // Extend rows only when the view is identity (safe vr == base mapping).
      let extraRows = 0;
      if (neededRows > rowCount) {
        if (identityView) extraRows = neededRows - rowCount;
        else
          toaster.push(
            <Message type="warning" showIcon closable>
              {str("Cannot add rows while sorted or filtered")}
            </Message>,
            { placement: "topCenter", duration: 4000 },
          );
      }

      pushHistory();
      const targetCols = Math.max(colCount, neededCols);
      if (workingHeaders !== headers) {
        setHeaders(workingHeaders);
        setColWidths(workingWidths);
      }
      setRows((prev) => {
        const next = prev.slice();
        for (let i = 0; i < extraRows; i++)
          next.push(new Array(targetCols).fill(""));
        const limit = identityView ? next.length : prev.length;
        for (let i = 0; i < pRows; i++) {
          const vr = r1 + i;
          if (vr >= limit) break;
          const base = identityView ? vr : viewOrder[vr];
          if (base == null) break;
          const arr = next[base].slice();
          while (arr.length < targetCols) arr.push("");
          for (let j = 0; j < pCols; j++) {
            const v = matrix[i][j];
            if (v !== undefined) arr[c1 + j] = v;
          }
          next[base] = arr;
        }
        return next;
      });
      setCopied(null);
    },
    [
      selRect,
      headers,
      colWidths,
      colCount,
      rowCount,
      identityView,
      viewOrder,
      pushHistory,
      str,
    ],
  );

  const doPaste = useCallback(
    (e) => {
      if (isEditingActive()) return;
      let text = "";
      if (e?.clipboardData) {
        text = e.clipboardData.getData("text/plain");
        e.preventDefault();
        applyPaste(parseClipboard(text));
      } else if (navigator.clipboard) {
        navigator.clipboard
          .readText()
          .then((t) => applyPaste(parseClipboard(t)))
          .catch(() =>
            toaster.push(
              <Message type="error" showIcon closable>
                {str("Nothing to paste")}
              </Message>,
              { placement: "topCenter" },
            ),
          );
      }
    },
    [applyPaste, str, isEditingActive],
  );

  // ---- Row / column structural ops ----
  const insertRows = useCallback(
    (atBase, count = 1) => {
      pushHistory();
      setRows((prev) => {
        const next = prev.slice();
        const blank = () => new Array(colCount).fill("");
        const pos = clamp(atBase, 0, next.length);
        for (let i = 0; i < count; i++) next.splice(pos, 0, blank());
        return next;
      });
    },
    [pushHistory, colCount],
  );

  const deleteRows = useCallback(() => {
    const { r1, r2 } = selRect;
    const bases = new Set();
    for (let vr = r1; vr <= r2; vr++) bases.add(viewOrder[vr]);
    pushHistory();
    setRows((prev) => {
      const next = prev.filter((_, i) => !bases.has(i));
      return next.length ? next : [new Array(colCount).fill("")];
    });
    setSelection((s) => ({
      anchor: { r: Math.min(s.anchor.r, r1), c: s.anchor.c },
      focus: { r: Math.min(s.focus.r, r1), c: s.focus.c },
    }));
  }, [selRect, viewOrder, pushHistory, colCount]);

  const insertColumns = useCallback(
    (at, count = 1) => {
      pushHistory();
      const pos = clamp(at, 0, colCount);
      setHeaders((prev) => {
        const next = prev.slice();
        for (let i = 0; i < count; i++) next.splice(pos + i, 0, colLabel(colCount + i));
        return next;
      });
      setColWidths((prev) => {
        const next = prev.slice();
        for (let i = 0; i < count; i++) next.splice(pos + i, 0, DEFAULT_COL_W);
        return next;
      });
      setRows((prev) =>
        prev.map((r) => {
          const next = r.slice();
          for (let i = 0; i < count; i++) next.splice(pos + i, 0, "");
          return next;
        }),
      );
    },
    [pushHistory, colCount],
  );

  const deleteColumns = useCallback(() => {
    const { c1, c2 } = selRect;
    if (colCount - (c2 - c1 + 1) < 1) return; // keep at least one column
    pushHistory();
    const keep = (arr) => arr.filter((_, i) => i < c1 || i > c2);
    setHeaders((prev) => keep(prev));
    setColWidths((prev) => keep(prev));
    setRows((prev) => prev.map((r) => keep(r)));
    setSelection((s) => ({
      anchor: { r: s.anchor.r, c: Math.min(s.anchor.c, c1) },
      focus: { r: s.focus.r, c: Math.min(s.focus.c, c1) },
    }));
  }, [selRect, colCount, pushHistory]);

  const addColumnEnd = useCallback(() => insertColumns(colCount, 1), [
    insertColumns,
    colCount,
  ]);
  const addRowEnd = useCallback(() => {
    if (!identityView) {
      toaster.push(
        <Message type="warning" showIcon closable>
          {str("Cannot add rows while sorted or filtered")}
        </Message>,
        { placement: "topCenter", duration: 4000 },
      );
      return;
    }
    insertRows(rows.length, 1);
  }, [identityView, insertRows, rows.length, str]);

  // ---- Header sort / rename / filter ----
  const toggleSort = useCallback((col) => {
    setSort((prev) => {
      if (!prev || prev.col !== col) return { col, dir: "asc" };
      if (prev.dir === "asc") return { col, dir: "desc" };
      return null;
    });
  }, []);

  const commitRename = useCallback(() => {
    if (renaming == null) return;
    const name = renameValue.trim() || colLabel(renaming);
    pushHistory();
    setHeaders((prev) => {
      const next = prev.slice();
      next[renaming] = name;
      return next;
    });
    setRenaming(null);
  }, [renaming, renameValue, pushHistory]);

  // ---- Fill handle ----
  const applyFill = useCallback(
    (target) => {
      const src = selRect;
      const r1 = Math.min(src.r1, target.r);
      const r2 = Math.max(src.r2, target.r);
      const c1 = Math.min(src.c1, target.c);
      const c2 = Math.max(src.c2, target.c);
      const srcRows = src.r2 - src.r1 + 1;
      const srcCols = src.c2 - src.c1 + 1;
      const changes = [];
      for (let vr = r1; vr <= r2; vr++) {
        const base = viewOrder[vr];
        if (base == null) continue;
        for (let c = c1; c <= c2; c++) {
          const inSrc =
            vr >= src.r1 && vr <= src.r2 && c >= src.c1 && c <= src.c2;
          if (inSrc) continue;
          const sr = src.r1 + ((vr - src.r1) % srcRows + srcRows) % srcRows;
          const sc = src.c1 + ((c - src.c1) % srcCols + srcCols) % srcCols;
          const value = rows[viewOrder[sr]]?.[sc] ?? "";
          changes.push({ r: base, c, value });
        }
      }
      setCells(changes);
      setSelection({ anchor: { r: r1, c: c1 }, focus: { r: r2, c: c2 } });
    },
    [selRect, viewOrder, rows, setCells],
  );

  // ---- Pointer -> cell mapping ----
  const pointerToCell = useCallback(
    (clientX, clientY) => {
      const el = scrollRef.current;
      const rect = el.getBoundingClientRect();
      const x = clientX - rect.left + el.scrollLeft - gutterW;
      const y = clientY - rect.top + el.scrollTop - headerTotal;
      const c = findCol(x);
      const r = clamp(Math.floor(y / ROW_H), 0, Math.max(0, rowCount - 1));
      return { r, c };
    },
    [gutterW, headerTotal, findCol, rowCount],
  );

  // ---- Mouse drag selection ----
  const onCellMouseDown = useCallback(
    (e, r, c) => {
      if (e.button === 2) {
        // right click: keep selection if inside, else select cell
        if (
          r < selRect.r1 ||
          r > selRect.r2 ||
          c < selRect.c1 ||
          c > selRect.c2
        )
          setSelection({ anchor: { r, c }, focus: { r, c } });
        return;
      }
      if (editing) commitEdit(null);
      scrollRef.current?.focus();
      const extend = e.shiftKey;
      setSelection((prev) => ({
        anchor: extend ? prev.anchor : { r, c },
        focus: { r, c },
      }));
      dragRef.current = { mode: "select" };
      const onMove = (ev) => {
        const cell = pointerToCell(ev.clientX, ev.clientY);
        setSelection((prev) => ({ anchor: prev.anchor, focus: cell }));
      };
      const onUp = () => {
        dragRef.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [editing, commitEdit, pointerToCell, selRect],
  );

  const onFillMouseDown = useCallback(
    (e) => {
      e.stopPropagation();
      e.preventDefault();
      scrollRef.current?.focus();
      dragRef.current = { mode: "fill" };
      let last = null;
      const onMove = (ev) => {
        last = pointerToCell(ev.clientX, ev.clientY);
      };
      const onUp = () => {
        if (last) applyFill(last);
        dragRef.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [pointerToCell, applyFill],
  );

  // ---- Keyboard ----
  const onKeyDown = useCallback(
    (e) => {
      if (editing || renaming != null) return;
      const meta = e.ctrlKey || e.metaKey;
      const { r, c } = selection.focus;
      const pageRows = Math.max(1, Math.floor(viewport.height / ROW_H) - 1);

      if (meta && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setSelection({
          anchor: { r: 0, c: 0 },
          focus: { r: rowCount - 1, c: colCount - 1 },
        });
        return;
      }
      if (meta && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
        return;
      }
      if (meta && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) {
        e.preventDefault();
        redo();
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setFocus(meta ? rowCount - 1 : r + 1, c, e.shiftKey);
          return;
        case "ArrowUp":
          e.preventDefault();
          setFocus(meta ? 0 : r - 1, c, e.shiftKey);
          return;
        case "ArrowRight":
          e.preventDefault();
          setFocus(r, meta ? colCount - 1 : c + 1, e.shiftKey);
          return;
        case "ArrowLeft":
          e.preventDefault();
          setFocus(r, meta ? 0 : c - 1, e.shiftKey);
          return;
        case "Home":
          e.preventDefault();
          setFocus(meta ? 0 : r, 0, e.shiftKey);
          return;
        case "End":
          e.preventDefault();
          setFocus(meta ? rowCount - 1 : r, colCount - 1, e.shiftKey);
          return;
        case "PageDown":
          e.preventDefault();
          setFocus(r + pageRows, c, e.shiftKey);
          return;
        case "PageUp":
          e.preventDefault();
          setFocus(r - pageRows, c, e.shiftKey);
          return;
        case "Tab":
          e.preventDefault();
          setFocus(r, c + (e.shiftKey ? -1 : 1), false);
          return;
        case "Enter":
          e.preventDefault();
          startEdit(r, c);
          return;
        case "F2":
          e.preventDefault();
          startEdit(r, c);
          return;
        case "Delete":
        case "Backspace":
          e.preventDefault();
          clearSelection();
          return;
        case "Escape":
          setCopied(null);
          return;
        default:
          if (e.key.length === 1 && !meta && !e.altKey) {
            e.preventDefault();
            startEdit(r, c, e.key);
          }
      }
    },
    [
      editing,
      renaming,
      selection,
      viewport.height,
      rowCount,
      colCount,
      setFocus,
      startEdit,
      clearSelection,
      undo,
      redo,
    ],
  );

  // ---- Column resize ----
  const onResizeMouseDown = useCallback(
    (e, col) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startW = colWidths[col] || DEFAULT_COL_W;
      resizeRef.current = col;
      forceHistory((n) => n + 1);
      const onMove = (ev) => {
        const w = Math.max(MIN_COL_W, startW + ev.clientX - startX);
        setColWidths((prev) => {
          const next = prev.slice();
          next[col] = w;
          return next;
        });
      };
      const onUp = () => {
        resizeRef.current = null;
        forceHistory((n) => n + 1);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [colWidths],
  );

  // ---- Context menu ----
  const openContextMenu = useCallback((e) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [contextMenu]);

  // ---- Selection statistics ----
  const stats = useMemo(() => {
    const { r1, r2, c1, c2 } = selRect;
    const total = (r2 - r1 + 1) * (c2 - c1 + 1);
    if (total > STATS_LIMIT) return { total, count: null };
    let count = 0;
    let numCount = 0;
    let sum = 0;
    for (let vr = r1; vr <= r2; vr++) {
      const row = rows[viewOrder[vr]];
      if (!row) continue;
      for (let c = c1; c <= c2; c++) {
        const v = row[c];
        if (v !== "" && v != null) {
          count++;
          if (isNumeric(v)) {
            numCount++;
            sum += parseFloat(v);
          }
        }
      }
    }
    return { total, count, numCount, sum };
  }, [selRect, rows, viewOrder]);

  const handleSave = useCallback(() => {
    let outRows = rows;
    if (editing) {
      const base = viewOrder[editing.r];
      if (
        base != null &&
        String(rows[base]?.[editing.c] ?? "") !== editValue
      ) {
        outRows = rows.slice();
        const arr = outRows[base].slice();
        while (arr.length < colCount) arr.push("");
        arr[editing.c] = editValue;
        outRows[base] = arr;
      }
      setEditing(null);
    }
    const csv = serializeCsv(headers, outRows);
    onSave(csv);
    onClose();
  }, [editing, editValue, viewOrder, colCount, headers, rows, onSave, onClose]);

  // ---- Render helpers ----
  const sortFor = (c) => (sort && sort.col === c ? sort.dir : null);

  const renderHeaderCells = () => {
    const cells = [];
    for (let c = firstCol; c < lastCol; c++) {
      const left = gutterW + colOffsets[c];
      const width = colWidths[c] || DEFAULT_COL_W;
      const isColSel = c >= selRect.c1 && c <= selRect.c2;
      const dir = sortFor(c);
      cells.push(
        <div
          key={c}
          className={`sheet-head-cell${isColSel ? " is-col-selected" : ""}`}
          style={{ left, width, height: HEADER_H }}
          data-testid={`sheet-head-${c}`}
          onMouseDown={(e) => {
            if (e.button !== 0) return;
            scrollRef.current?.focus();
            setSelection({
              anchor: { r: 0, c },
              focus: { r: rowCount - 1, c },
            });
          }}
        >
          {renaming === c ? (
            <input
              className="sheet-head-rename-input"
              value={renameValue}
              autoFocus
              data-testid={`sheet-head-rename-${c}`}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                else if (e.key === "Escape") setRenaming(null);
                e.stopPropagation();
              }}
            />
          ) : (
            <div
              className="sheet-head-name"
              title={headers[c]}
              onClick={(e) => {
                e.stopPropagation();
                toggleSort(c);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                setRenaming(c);
                setRenameValue(headers[c]);
              }}
            >
              <span className="sheet-head-label">{headers[c]}</span>
              {dir && (
                <span className="sheet-head-sort">
                  {dir === "asc" ? <ArrowUp size={13} /> : <ArrowDown size={13} />}
                </span>
              )}
            </div>
          )}
          <div
            className={`sheet-resize-handle${resizeRef.current === c ? " is-active" : ""}`}
            data-testid={`sheet-resize-${c}`}
            onMouseDown={(e) => onResizeMouseDown(e, c)}
          />
        </div>,
      );
    }
    return cells;
  };

  const renderFilterCells = () => {
    if (!showFilters) return null;
    const cells = [];
    for (let c = firstCol; c < lastCol; c++) {
      const left = gutterW + colOffsets[c];
      const width = colWidths[c] || DEFAULT_COL_W;
      cells.push(
        <div
          key={c}
          className="sheet-filter-cell"
          style={{ left, width, top: HEADER_H, height: FILTER_H }}
        >
          <input
            className="sheet-filter-input"
            placeholder={str("Filter")}
            value={filters[c] || ""}
            data-testid={`sheet-filter-${c}`}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, [c]: e.target.value }))
            }
          />
        </div>,
      );
    }
    return cells;
  };

  const renderRows = () => {
    const els = [];
    for (let vr = firstRow; vr < lastRow; vr++) {
      const base = viewOrder[vr];
      const row = rows[base] || [];
      const rowSel = vr >= selRect.r1 && vr <= selRect.r2;
      const cells = [];
      for (let c = firstCol; c < lastCol; c++) {
        const left = gutterW + colOffsets[c];
        const width = colWidths[c] || DEFAULT_COL_W;
        const val = row[c] == null ? "" : row[c];
        const isEditing = editing && editing.r === vr && editing.c === c;
        cells.push(
          <div
            key={c}
            className={`sheet-cell${vr % 2 ? " is-alt" : ""}`}
            style={{ left, width, height: ROW_H }}
            data-testid={`sheet-cell-${vr}-${c}`}
            onMouseDown={(e) => onCellMouseDown(e, vr, c)}
            onDoubleClick={() => startEdit(vr, c)}
          >
            {!isEditing && (
              <span
                className={`sheet-cell-text${isNumeric(val) ? " is-number" : ""}`}
              >
                {val}
              </span>
            )}
          </div>,
        );
      }
      els.push(
        <div
          key={base}
          className="sheet-row"
          style={{ top: vr * ROW_H, height: ROW_H, width: canvasW }}
        >
          <div
            className={`sheet-rownum${rowSel ? " is-row-selected" : ""}`}
            style={{ width: gutterW, height: ROW_H }}
            data-testid={`sheet-rownum-${vr}`}
            onMouseDown={(e) => {
              if (e.button !== 0) return;
              scrollRef.current?.focus();
              setSelection({
                anchor: { r: vr, c: 0 },
                focus: { r: vr, c: colCount - 1 },
              });
            }}
          >
            {vr + 1}
          </div>
          {cells}
        </div>,
      );
    }
    return els;
  };

  // selection / active overlays (body coordinate space)
  const overlays = useMemo(() => {
    if (!rowCount || !colCount) return null;
    const { r1, r2, c1, c2 } = selRect;
    const selStyle = {
      left: gutterW + colOffsets[c1],
      top: r1 * ROW_H,
      width: colOffsets[c2 + 1] - colOffsets[c1],
      height: (r2 - r1 + 1) * ROW_H,
    };
    const { r, c } = selection.focus;
    const activeStyle = {
      left: gutterW + colOffsets[c],
      top: r * ROW_H,
      width: colWidths[c] || DEFAULT_COL_W,
      height: ROW_H,
    };
    return (
      <>
        <div className="sheet-selection" style={selStyle} />
        <div className="sheet-active" style={activeStyle} />
        {!editing && (
          <div
            className="sheet-fill-handle"
            data-testid="sheet-fill-handle"
            style={{
              left: gutterW + colOffsets[c2 + 1] - 4,
              top: (r2 + 1) * ROW_H - 4,
            }}
            onMouseDown={onFillMouseDown}
          />
        )}
        {copied && (
          <div
            className="sheet-copied"
            style={{
              left: gutterW + colOffsets[copied.c1],
              top: copied.r1 * ROW_H,
              width: colOffsets[copied.c2 + 1] - colOffsets[copied.c1],
              height: (copied.r2 - copied.r1 + 1) * ROW_H,
            }}
          />
        )}
      </>
    );
  }, [
    rowCount,
    colCount,
    selRect,
    selection.focus,
    colOffsets,
    colWidths,
    gutterW,
    editing,
    copied,
    onFillMouseDown,
  ]);

  // edit input overlay
  const editOverlay = useMemo(() => {
    if (!editing) return null;
    const left = gutterW + colOffsets[editing.c];
    const top = headerTotal + editing.r * ROW_H;
    const width = Math.max(colWidths[editing.c] || DEFAULT_COL_W, 80);
    return (
      <input
        ref={editInputRef}
        className="sheet-cell-input"
        style={{ left, top, width, height: ROW_H }}
        value={editValue}
        data-testid="sheet-cell-input"
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={() => commitEdit(null)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") {
            e.preventDefault();
            commitEdit({ dr: e.shiftKey ? -1 : 1, dc: 0 });
          } else if (e.key === "Tab") {
            e.preventDefault();
            commitEdit({ dr: 0, dc: e.shiftKey ? -1 : 1 });
          } else if (e.key === "Escape") {
            e.preventDefault();
            cancelEdit();
          }
        }}
      />
    );
  }, [
    editing,
    editValue,
    gutterW,
    colOffsets,
    colWidths,
    headerTotal,
    commitEdit,
    cancelEdit,
  ]);

  const canUndo = pastRef.current.length > 0;
  const canRedo = futureRef.current.length > 0;
  const multiRowSel = selRect.r2 > selRect.r1;

  return (
    <Drawer open={open} onClose={onClose} size="full">
      <Drawer.Header>
        <Drawer.Title>
          <Trans>Edit CSV</Trans>: {fileName}
        </Drawer.Title>
        <Drawer.Actions>
          <Button onClick={onClose} appearance="subtle" data-testid="sheet-cancel">
            <Trans>Cancel</Trans>
          </Button>
          <Button onClick={handleSave} appearance="primary" data-testid="sheet-save">
            <Trans>Save</Trans>
          </Button>
        </Drawer.Actions>
      </Drawer.Header>
      <Drawer.Body style={{ padding: 0, height: "100%", overflow: "hidden" }}>
        {open && (
          <div className="sheet-editor-root">
            <div className="sheet-editor-toolbar">
              <IconButton
                size="sm"
                icon={<Undo2 size={16} />}
                appearance="subtle"
                disabled={!canUndo}
                onClick={undo}
                title={str("Undo")}
                data-testid="sheet-undo"
              />
              <IconButton
                size="sm"
                icon={<Redo2 size={16} />}
                appearance="subtle"
                disabled={!canRedo}
                onClick={redo}
                title={str("Redo")}
                data-testid="sheet-redo"
              />
              <div className="sheet-toolbar-divider" />
              <Button
                size="sm"
                appearance="subtle"
                onClick={addRowEnd}
                data-testid="sheet-add-row"
              >
                <Plus size={15} style={{ marginRight: 4 }} />
                <Trans>Add row</Trans>
              </Button>
              <Button
                size="sm"
                appearance="subtle"
                onClick={addColumnEnd}
                data-testid="sheet-add-column"
              >
                <Plus size={15} style={{ marginRight: 4 }} />
                <Trans>Add column</Trans>
              </Button>
              <Button
                size="sm"
                appearance="subtle"
                color="red"
                onClick={deleteRows}
                disabled={!multiRowSel && rowCount <= 1}
                data-testid="sheet-delete-rows"
              >
                <Trash2 size={15} style={{ marginRight: 4 }} />
                <Trans>Delete rows</Trans>
              </Button>
              <Button
                size="sm"
                appearance="subtle"
                color="red"
                onClick={deleteColumns}
                disabled={colCount <= 1}
                data-testid="sheet-delete-columns"
              >
                <ChevronsLeftRight size={15} style={{ marginRight: 4 }} />
                <Trans>Delete columns</Trans>
              </Button>
              <div className="sheet-toolbar-divider" />
              <IconButton
                size="sm"
                icon={<Filter size={16} />}
                appearance={showFilters ? "primary" : "subtle"}
                onClick={() => setShowFilters((s) => !s)}
                title={str("Filters")}
                data-testid="sheet-toggle-filters"
              />
              <div className="sheet-toolbar-spacer" />
              <InputGroup size="sm" className="sheet-quickfilter">
                <Input
                  placeholder={str("Search all cells…")}
                  value={quickFilter}
                  onChange={setQuickFilter}
                  data-testid="sheet-quickfilter"
                />
                <InputGroup.Addon>
                  <Search size={14} />
                </InputGroup.Addon>
              </InputGroup>
            </div>

            <div className="sheet-grid">
              <div
                className="sheet-scroll"
                ref={scrollRef}
                tabIndex={0}
                data-testid="sheet-scroll"
                onScroll={handleScroll}
                onKeyDown={onKeyDown}
                onCopy={doCopy}
                onCut={doCut}
                onPaste={doPaste}
                onContextMenu={openContextMenu}
              >
                <div className="sheet-canvas" style={{ width: canvasW, height: canvasH }}>
                  <div
                    className="sheet-header"
                    style={{ width: canvasW, height: headerTotal }}
                  >
                    <div
                      className="sheet-corner"
                      style={{ width: gutterW, height: headerTotal }}
                      data-testid="sheet-select-all"
                      onClick={() =>
                        setSelection({
                          anchor: { r: 0, c: 0 },
                          focus: { r: rowCount - 1, c: colCount - 1 },
                        })
                      }
                    />
                    {renderHeaderCells()}
                    {showFilters && (
                      <div
                        className="sheet-filter-corner"
                        style={{ width: gutterW, top: HEADER_H, height: FILTER_H }}
                      />
                    )}
                    {renderFilterCells()}
                  </div>
                  <div
                    className="sheet-body"
                    style={{ top: headerTotal, width: canvasW, height: rowCount * ROW_H }}
                  >
                    {renderRows()}
                    {overlays}
                  </div>
                  {editOverlay}
                </div>
              </div>
            </div>

            <div className="sheet-statusbar" data-testid="sheet-statusbar">
              <span>
                <strong>{rowCount}</strong> <Trans>rows</Trans>
              </span>
              <span>
                <strong>{colCount}</strong> <Trans>columns</Trans>
              </span>
              <div className="sheet-stat-spacer" />
              {stats.count != null && stats.total > 1 && (
                <>
                  <span>
                    <Trans>Count</Trans>: <strong>{stats.count}</strong>
                  </span>
                  {stats.numCount > 0 && (
                    <>
                      <span>
                        <Trans>Sum</Trans>:{" "}
                        <strong>
                          {Number(stats.sum.toFixed(4)).toLocaleString()}
                        </strong>
                      </span>
                      <span>
                        <Trans>Average</Trans>:{" "}
                        <strong>
                          {Number(
                            (stats.sum / stats.numCount).toFixed(4),
                          ).toLocaleString()}
                        </strong>
                      </span>
                    </>
                  )}
                </>
              )}
              <span>
                {colLabel(selection.focus.c)}
                {selection.focus.r + 1}
              </span>
            </div>

            {contextMenu && (
              <div
                className="sheet-context-menu"
                style={{ left: contextMenu.x, top: contextMenu.y }}
                data-testid="sheet-context-menu"
              >
                <div
                  className="sheet-context-item"
                  data-testid="ctx-copy"
                  onClick={() => doCopy(null)}
                >
                  <Copy size={15} /> <Trans>Copy</Trans>
                  <span className="sheet-context-shortcut">Ctrl+C</span>
                </div>
                <div
                  className="sheet-context-item"
                  data-testid="ctx-cut"
                  onClick={() => doCut(null)}
                >
                  <Scissors size={15} /> <Trans>Cut</Trans>
                  <span className="sheet-context-shortcut">Ctrl+X</span>
                </div>
                <div
                  className="sheet-context-item"
                  data-testid="ctx-paste"
                  onClick={() => doPaste(null)}
                >
                  <ClipboardPaste size={15} /> <Trans>Paste</Trans>
                  <span className="sheet-context-shortcut">Ctrl+V</span>
                </div>
                <div className="sheet-context-sep" />
                <div
                  className="sheet-context-item"
                  data-testid="ctx-insert-row-above"
                  onClick={() => insertRows(viewOrder[selRect.r1], 1)}
                >
                  <Trans>Insert row above</Trans>
                </div>
                <div
                  className="sheet-context-item"
                  data-testid="ctx-insert-row-below"
                  onClick={() => insertRows(viewOrder[selRect.r2] + 1, 1)}
                >
                  <Trans>Insert row below</Trans>
                </div>
                <div
                  className="sheet-context-item"
                  data-testid="ctx-insert-col-left"
                  onClick={() => insertColumns(selRect.c1, 1)}
                >
                  <Trans>Insert column left</Trans>
                </div>
                <div
                  className="sheet-context-item"
                  data-testid="ctx-insert-col-right"
                  onClick={() => insertColumns(selRect.c2 + 1, 1)}
                >
                  <Trans>Insert column right</Trans>
                </div>
                <div className="sheet-context-sep" />
                <div
                  className="sheet-context-item"
                  data-testid="ctx-sort-asc"
                  onClick={() => setSort({ col: selection.focus.c, dir: "asc" })}
                >
                  <ArrowUp size={15} /> <Trans>Sort ascending</Trans>
                </div>
                <div
                  className="sheet-context-item"
                  data-testid="ctx-sort-desc"
                  onClick={() => setSort({ col: selection.focus.c, dir: "desc" })}
                >
                  <ArrowDown size={15} /> <Trans>Sort descending</Trans>
                </div>
                <div className="sheet-context-sep" />
                <div
                  className="sheet-context-item is-danger"
                  data-testid="ctx-clear"
                  onClick={clearSelection}
                >
                  <Trans>Clear contents</Trans>
                </div>
                <div
                  className="sheet-context-item is-danger"
                  data-testid="ctx-delete-rows"
                  onClick={deleteRows}
                >
                  <Trash2 size={15} /> <Trans>Delete rows</Trans>
                </div>
                <div
                  className="sheet-context-item is-danger"
                  data-testid="ctx-delete-cols"
                  onClick={deleteColumns}
                >
                  <Trans>Delete columns</Trans>
                </div>
              </div>
            )}
          </div>
        )}
      </Drawer.Body>
    </Drawer>
  );
};

export default SpreadsheetEditor;
