import {
  useCallback,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Drawer,
  Button,
  Input,
  InputGroup,
  IconButton,
  Message,
  toaster,
  Dropdown,
  Modal,
} from "rsuite";
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
  ChevronDown,
  Pin,
  Wand2,
} from "lucide-react";
import {
  useLocale,
  registerTranslations,
} from "../../localization/LocaleContext";
import Trans from "../../localization/Trans";
import FloatingMenu from "./spreadsheet/FloatingMenu";
import ColumnMenu from "./spreadsheet/ColumnMenu";
import FindReplacePanel from "./spreadsheet/FindReplacePanel";
import FormulaBar from "./spreadsheet/FormulaBar";
import {
  clamp,
  colLabel,
  isNumeric,
  parseCsv,
  serializeCsv,
  buildClipboardText,
  parseClipboard,
  fillSeries,
  dataEdge,
  findDuplicateRows,
  findMatches,
  replaceInCell,
  advanceActiveInBlock,
  estimateColumnWidth,
  computeFillRect,
  parseAddress,
} from "./spreadsheet/sheetOps";
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
  Sum: "Сума",
  Average: "Середнє",
  Count: "Кількість",
  Filter: "Фільтр",
  "Edit CSV": "Редагування CSV",
  "Rename column": "Перейменувати колонку",
  "Nothing to paste": "Нічого вставляти",
  "Cannot add rows while sorted or filtered":
    "Неможливо додати рядки під час сортування або фільтрування",
  Freeze: "Закріпити",
  "Freeze first column": "Закріпити перший стовпець",
  "Freeze up to this column": "Закріпити до цього стовпця",
  "Unfreeze columns": "Відкріпити стовпці",
  Insert: "Вставка",
  Find: "Знайти",
  Replace: "Замінити",
  "Match case": "Врахувати регістр",
  "Match entire cell contents": "Точна відповідність клітинки",
  "No matches": "Збігів не знайдено",
  "Replace all": "Замінити все",
  Replaced: "Замінено",
  occurrences: "входжень",
  "Remove duplicate rows": "Видалити дублікати рядків",
  "Trim whitespace": "Прибрати зайві пробіли",
  "Apply sort to data": "Застосувати сортування до даних",
  "Clear all filters": "Прибрати всі фільтри",
  "Sorted by": "Відсортовано за",
  Apply: "Застосувати",
  "Select all": "Обрати все",
  "(Blanks)": "(Порожньо)",
  "more — refine search": "ще — уточніть пошук",
  "Clear filter": "Прибрати фільтр",
  "Auto-fit column width": "Підібрати ширину колонки",
  "Search values…": "Пошук значень…",
  "Invalid reference": "Невірне посилання на клітинку",
  "Filter by value": "Фільтрувати за значенням",
  "No duplicate rows found": "Дублікатів не знайдено",
  "duplicate rows removed": "рядків-дублікатів видалено",
  "Nothing to trim": "Немає зайвих пробілів",
  "cells trimmed": "клітинок очищено від пробілів",
  "Clear filters to apply sort to data":
    "Прибрати фільтри, щоб застосувати сортування до даних",
  "Unsaved changes": "Незбережені зміни",
  "You have unsaved changes. Save them before closing?":
    "У вас є незбережені зміни. Зберегти їх перед закриттям?",
  Min: "Мін",
  Max: "Макс",
});

const ROW_H = 28;
const HEADER_H = 34;
const FILTER_H = 32;
const DEFAULT_COL_W = 140;
const MIN_COL_W = 48;
const MAX_COL_W = 480;
const OVERSCAN_Y = 8;
const OVERSCAN_X = 3;
const MAX_HISTORY = 60;
const STATS_LIMIT = 200000;

const ARROW_DELTA = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
};

const SpreadsheetEditor = ({ open, onClose, onSave, fileName, csvData }) => {
  const { str } = useLocale();

  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [colWidths, setColWidths] = useState([]);
  const [frozenCols, setFrozenCols] = useState(0);

  const [filters, setFilters] = useState({});
  const [valueFilters, setValueFilters] = useState({}); // { col: Set<string> }
  const [quickFilter, setQuickFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [sort, setSort] = useState(null); // { col, dir: 'asc' | 'desc' }

  // selection in VIEW coordinates: { anchor:{r,c}, focus:{r,c}, active:{r,c} }
  // anchor/focus define the selected rectangle; active is the highlighted
  // cell within it (Excel semantics: Enter/Tab cycle `active` inside a
  // multi-cell block without changing the rectangle).
  const [selection, setSelection] = useState({
    anchor: { r: 0, c: 0 },
    focus: { r: 0, c: 0 },
    active: { r: 0, c: 0 },
  });
  const [editing, setEditing] = useState(null); // { r, c, mode: 'edit' | 'enter' }
  const [editValue, setEditValue] = useState("");
  const [renaming, setRenaming] = useState(null); // col index
  const [renameValue, setRenameValue] = useState("");

  const [copied, setCopied] = useState(null); // { r1,r2,c1,c2, cut } view coords
  const [fillPreview, setFillPreview] = useState(null); // { r1,r2,c1,c2 } view coords
  const [contextMenu, setContextMenu] = useState(null); // { x, y }
  const [colMenu, setColMenu] = useState(null); // { col, x, y }

  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [findReplacement, setFindReplacement] = useState("");
  const [findMatchCase, setFindMatchCase] = useState(false);
  const [findWholeCell, setFindWholeCell] = useState(false);
  const [findShowReplace, setFindShowReplace] = useState(false);
  const [findActiveIndex, setFindActiveIndex] = useState(0);
  const deferredFindQuery = useDeferredValue(findQuery);

  const [unsavedDialogOpen, setUnsavedDialogOpen] = useState(false);

  const [scroll, setScroll] = useState({ top: 0, left: 0 });
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  const pastRef = useRef([]);
  const futureRef = useRef([]);
  const [, forceHistory] = useState(0);

  const savedHeadersRef = useRef([]);
  const savedRowsRef = useRef([]);
  const cutSourceRef = useRef(null); // { baseRows:number[], c1, c2 }
  const headerRefs = useRef({});

  const scrollRef = useRef(null);
  const rafRef = useRef(0);
  const resizeRef = useRef(null);
  const editInputRef = useRef(null);
  const nameBoxRef = useRef(null);

  // ---- Load / reset when opened with new data ----
  useEffect(() => {
    if (!open) return;
    const { headers: h, rows: r } = parseCsv(csvData);
    setHeaders(h);
    setRows(r);
    setColWidths(h.map(() => DEFAULT_COL_W));
    setFrozenCols(0);
    setFilters({});
    setValueFilters({});
    setQuickFilter("");
    setSort(null);
    setSelection({
      anchor: { r: 0, c: 0 },
      focus: { r: 0, c: 0 },
      active: { r: 0, c: 0 },
    });
    setEditing(null);
    setCopied(null);
    setFillPreview(null);
    setContextMenu(null);
    setColMenu(null);
    setFindOpen(false);
    setFindQuery("");
    setFindReplacement("");
    setUnsavedDialogOpen(false);
    cutSourceRef.current = null;
    savedHeadersRef.current = h;
    savedRowsRef.current = r;
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
    () =>
      quickFilter.trim() !== "" ||
      Object.values(filters).some((v) => v) ||
      Object.values(valueFilters).some((v) => v),
    [quickFilter, filters, valueFilters],
  );
  const identityView = !sort && !hasFilters;

  // ---- Derived view order (filter + sort), array of base row indices ----
  const viewOrder = useMemo(() => {
    let idx = rows.map((_, i) => i);
    const q = quickFilter.trim().toLowerCase();
    const colFilters = Object.entries(filters).filter(([, v]) => v);
    const valFilterEntries = Object.entries(valueFilters).filter(([, v]) => v);
    if (q || colFilters.length || valFilterEntries.length) {
      idx = idx.filter((i) => {
        const row = rows[i];
        if (q && !row.some((cell) => String(cell).toLowerCase().includes(q)))
          return false;
        for (const [c, v] of colFilters) {
          if (!String(row[c] ?? "").toLowerCase().includes(v.toLowerCase()))
            return false;
        }
        for (const [cStr, set] of valFilterEntries) {
          const c = Number(cStr);
          const val = row[c] == null ? "" : String(row[c]);
          if (!set.has(val)) return false;
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
        return (
          String(av).localeCompare(String(bv), undefined, { numeric: true }) *
          mul
        );
      });
    }
    return idx;
  }, [rows, filters, quickFilter, valueFilters, sort]);

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
  const frozenColsClamped = Math.min(frozenCols, Math.max(0, colCount - 1));
  const frozenWidth = colOffsets[frozenColsClamped] || 0;

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
  const isColVisible = useCallback(
    (c) => c < frozenColsClamped || (c >= firstCol && c < lastCol),
    [frozenColsClamped, firstCol, lastCol],
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
      else if (cellBottom > viewTop + usableH) el.scrollTop = cellBottom - usableH;

      if (c >= frozenColsClamped) {
        const cellLeft = colOffsets[c];
        const cellRight = colOffsets[c + 1];
        const viewLeft = el.scrollLeft;
        const usableW = el.clientWidth - gutterW;
        if (cellLeft < viewLeft + frozenWidth)
          el.scrollLeft = Math.max(0, cellLeft - frozenWidth);
        else if (cellRight > viewLeft + usableW) el.scrollLeft = cellRight - usableW;
      }
    },
    [colOffsets, gutterW, headerTotal, frozenColsClamped, frozenWidth],
  );

  const setFocus = useCallback(
    (r, c, extend) => {
      const nr = clamp(r, 0, Math.max(0, rowCount - 1));
      const nc = clamp(c, 0, Math.max(0, colCount - 1));
      setSelection((prev) =>
        extend
          ? { anchor: prev.anchor, focus: { r: nr, c: nc }, active: { r: nr, c: nc } }
          : { anchor: { r: nr, c: nc }, focus: { r: nr, c: nc }, active: { r: nr, c: nc } },
      );
      scrollCellIntoView(nr, nc);
    },
    [rowCount, colCount, scrollCellIntoView],
  );

  const selectColumn = useCallback(
    (c, extend) => {
      setSelection((prev) => ({
        anchor: { r: 0, c: extend ? prev.anchor.c : c },
        focus: { r: rowCount - 1, c },
        active: { r: 0, c },
      }));
    },
    [rowCount],
  );

  const selectRow = useCallback(
    (r, extend) => {
      setSelection((prev) => ({
        anchor: { r: extend ? prev.anchor.r : r, c: 0 },
        focus: { r, c: colCount - 1 },
        active: { r, c: 0 },
      }));
    },
    [colCount],
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
    (r, c, initial, mode = "edit") => {
      const base = viewOrder[r];
      if (base == null) return;
      setEditing({ r, c, mode });
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

  useEffect(() => {
    if (editing && editInputRef.current) {
      const el = editInputRef.current;
      el.focus();
      const len = el.value.length;
      el.setSelectionRange(len, len);
    }
  }, [editing]);

  const editOverlayKeyDown = useCallback(
    (e) => {
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
      } else if (editing?.mode === "enter" && ARROW_DELTA[e.key]) {
        e.preventDefault();
        const [dr, dc] = ARROW_DELTA[e.key];
        commitEdit({ dr, dc });
      }
    },
    [editing, commitEdit, cancelEdit],
  );

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
    () => editInputRef.current && document.activeElement === editInputRef.current,
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
      cutSourceRef.current = null;
      setCopied({ r1, r2, c1, c2, cut: false });
    },
    [selRect, rows, viewOrder, isEditingActive],
  );

  const doCut = useCallback(
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
      const baseRows = [];
      for (let vr = r1; vr <= r2; vr++) baseRows.push(viewOrder[vr]);
      cutSourceRef.current = { baseRows, c1, c2 };
      setCopied({ r1, r2, c1, c2, cut: true });
    },
    [selRect, rows, viewOrder, isEditingActive],
  );

  const applyPaste = useCallback(
    (matrix) => {
      if (!matrix.length) return;
      const { r1, c1 } = selRect;
      const pRows = matrix.length;
      const pColsRaw = Math.max(...matrix.map((m) => m.length));
      const selRows = selRect.r2 - selRect.r1 + 1;
      const selCols = selRect.c2 - selRect.c1 + 1;
      const tileR = selRows > pRows && selRows % pRows === 0 ? selRows / pRows : 1;
      const tileC =
        selCols > pColsRaw && selCols % pColsRaw === 0 ? selCols / pColsRaw : 1;
      const effRows = pRows * tileR;
      const effCols = pColsRaw * tileC;
      const getPasteValue = (i, j) => matrix[i % pRows][j % pColsRaw];

      const neededRows = r1 + effRows;
      const neededCols = c1 + effCols;

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

      const cutInfo = cutSourceRef.current;
      const pastedKeys = new Set();

      setRows((prev) => {
        const next = prev.slice();
        for (let i = 0; i < extraRows; i++)
          next.push(new Array(targetCols).fill(""));
        const limit = identityView ? next.length : prev.length;
        for (let i = 0; i < effRows; i++) {
          const vr = r1 + i;
          if (vr >= limit) break;
          const base = identityView ? vr : viewOrder[vr];
          if (base == null) break;
          let arr = next[base];
          if (arr === prev[base]) arr = arr.slice();
          while (arr.length < targetCols) arr.push("");
          for (let j = 0; j < effCols; j++) {
            const v = getPasteValue(i, j);
            if (v !== undefined) {
              arr[c1 + j] = v;
              pastedKeys.add(base + ":" + (c1 + j));
            }
          }
          next[base] = arr;
        }
        if (cutInfo) {
          for (const br of cutInfo.baseRows) {
            if (br == null || br >= next.length) continue;
            let arr = next[br];
            for (let c = cutInfo.c1; c <= cutInfo.c2; c++) {
              if (pastedKeys.has(br + ":" + c)) continue;
              if (arr === prev[br]) arr = arr.slice();
              while (arr.length <= c) arr.push("");
              arr[c] = "";
            }
            next[br] = arr;
          }
        }
        return next;
      });
      cutSourceRef.current = null;
      setCopied(null);
      setSelection({
        anchor: { r: r1, c: c1 },
        focus: { r: r1 + effRows - 1, c: c1 + effCols - 1 },
        active: { r: r1, c: c1 },
      });
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
      if (e?.clipboardData) {
        const text = e.clipboardData.getData("text/plain");
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
    setSelection({
      anchor: { r: Math.min(selection.anchor.r, r1), c: selection.anchor.c },
      focus: { r: Math.min(selection.focus.r, r1), c: selection.focus.c },
      active: { r: Math.min(selection.active.r, r1), c: selection.active.c },
    });
  }, [selRect, viewOrder, pushHistory, colCount, selection]);

  const insertColumns = useCallback(
    (at, count = 1) => {
      pushHistory();
      const pos = clamp(at, 0, colCount);
      setHeaders((prev) => {
        const next = prev.slice();
        for (let i = 0; i < count; i++)
          next.splice(pos + i, 0, colLabel(colCount + i));
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
    if (colCount - (c2 - c1 + 1) < 1) return;
    pushHistory();
    const keep = (arr) => arr.filter((_, i) => i < c1 || i > c2);
    setHeaders((prev) => keep(prev));
    setColWidths((prev) => keep(prev));
    setRows((prev) => prev.map((r) => keep(r)));
    setSelection({
      anchor: { r: selection.anchor.r, c: Math.min(selection.anchor.c, c1) },
      focus: { r: selection.focus.r, c: Math.min(selection.focus.c, c1) },
      active: { r: selection.active.r, c: Math.min(selection.active.c, c1) },
    });
    setFrozenCols((f) => Math.max(0, f - (c2 - c1 + 1)));
  }, [selRect, colCount, pushHistory, selection]);

  const insertRowsAtSelection = useCallback(
    (before) => {
      const { r1, r2 } = selRect;
      const n = r2 - r1 + 1;
      const atBase = before ? viewOrder[r1] : viewOrder[r2] + 1;
      insertRows(atBase, n);
    },
    [selRect, viewOrder, insertRows],
  );

  const insertColumnsAtSelection = useCallback(
    (before) => {
      const { c1, c2 } = selRect;
      const n = c2 - c1 + 1;
      const at = before ? c1 : c2 + 1;
      insertColumns(at, n);
    },
    [selRect, insertColumns],
  );

  const selectionIsFullRows = selRect.c1 === 0 && selRect.c2 === colCount - 1;
  const selectionIsFullCols = selRect.r1 === 0 && selRect.r2 === rowCount - 1;

  const deleteSelectionRowsOrCols = useCallback(() => {
    if (selectionIsFullCols && !selectionIsFullRows) deleteColumns();
    else deleteRows();
  }, [selectionIsFullCols, selectionIsFullRows, deleteColumns, deleteRows]);

  const insertSelectionRowsOrCols = useCallback(() => {
    if (selectionIsFullCols && !selectionIsFullRows) insertColumnsAtSelection(true);
    else insertRowsAtSelection(true);
  }, [selectionIsFullCols, selectionIsFullRows, insertColumnsAtSelection, insertRowsAtSelection]);

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

  // ---- Rename ----
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

  // ---- Auto-fit ----
  const autoFitColumn = useCallback(
    (c) => {
      const values = [headers[c], ...rows.map((r) => r[c])];
      const w = estimateColumnWidth(values, { min: MIN_COL_W, max: MAX_COL_W });
      setColWidths((prev) => {
        const next = prev.slice();
        next[c] = w;
        return next;
      });
    },
    [headers, rows],
  );

  // ---- Fill (handle drag, Ctrl+D, Ctrl+R) ----
  const applyFill = useCallback(
    (target) => {
      const src = selRect;
      const result = computeFillRect(src, target);
      if (!result) return;
      const { r1, r2, c1, c2, axis, direction } = result;
      const changes = [];
      if (axis === "row") {
        for (let c = c1; c <= c2; c++) {
          const baseValues = [];
          for (let vr = src.r1; vr <= src.r2; vr++)
            baseValues.push(String(rows[viewOrder[vr]]?.[c] ?? ""));
          const ordered = direction === 1 ? baseValues : baseValues.slice().reverse();
          const filled = fillSeries(ordered, r2 - r1 + 1);
          const finalSeries = direction === 1 ? filled : filled.slice().reverse();
          for (let i = 0; i < finalSeries.length; i++) {
            const vr = r1 + i;
            if (vr >= src.r1 && vr <= src.r2) continue;
            const base = viewOrder[vr];
            if (base == null) continue;
            changes.push({ r: base, c, value: finalSeries[i] });
          }
        }
      } else {
        for (let vr = r1; vr <= r2; vr++) {
          const base = viewOrder[vr];
          if (base == null) continue;
          const baseValues = [];
          for (let c = src.c1; c <= src.c2; c++)
            baseValues.push(String(rows[base]?.[c] ?? ""));
          const ordered = direction === 1 ? baseValues : baseValues.slice().reverse();
          const filled = fillSeries(ordered, c2 - c1 + 1);
          const finalSeries = direction === 1 ? filled : filled.slice().reverse();
          for (let i = 0; i < finalSeries.length; i++) {
            const c = c1 + i;
            if (c >= src.c1 && c <= src.c2) continue;
            changes.push({ r: base, c, value: finalSeries[i] });
          }
        }
      }
      setCells(changes);
      setSelection({
        anchor: { r: r1, c: c1 },
        focus: { r: r2, c: c2 },
        active: { r: r1, c: c1 },
      });
    },
    [selRect, viewOrder, rows, setCells],
  );

  const fillDown = useCallback(() => {
    const { r1, r2, c1, c2 } = selRect;
    const changes = [];
    if (r1 === r2) {
      if (r1 === 0) return;
      const aboveBase = viewOrder[r1 - 1];
      const base = viewOrder[r1];
      if (aboveBase == null || base == null) return;
      for (let c = c1; c <= c2; c++)
        changes.push({ r: base, c, value: rows[aboveBase]?.[c] ?? "" });
    } else {
      const topBase = viewOrder[r1];
      if (topBase == null) return;
      for (let c = c1; c <= c2; c++) {
        const value = rows[topBase]?.[c] ?? "";
        for (let vr = r1 + 1; vr <= r2; vr++) {
          const base = viewOrder[vr];
          if (base == null) continue;
          changes.push({ r: base, c, value });
        }
      }
    }
    setCells(changes);
  }, [selRect, viewOrder, rows, setCells]);

  const fillRight = useCallback(() => {
    const { r1, r2, c1, c2 } = selRect;
    const changes = [];
    if (c1 === c2) {
      if (c1 === 0) return;
      for (let vr = r1; vr <= r2; vr++) {
        const base = viewOrder[vr];
        if (base == null) continue;
        changes.push({ r: base, c: c1, value: rows[base]?.[c1 - 1] ?? "" });
      }
    } else {
      for (let vr = r1; vr <= r2; vr++) {
        const base = viewOrder[vr];
        if (base == null) continue;
        const value = rows[base]?.[c1] ?? "";
        for (let c = c1 + 1; c <= c2; c++) changes.push({ r: base, c, value });
      }
    }
    setCells(changes);
  }, [selRect, viewOrder, rows, setCells]);

  // ---- Data cleanup ----
  const removeDuplicateRowsAction = useCallback(() => {
    const dupIndices = findDuplicateRows(rows);
    if (!dupIndices.length) {
      toaster.push(
        <Message type="info" showIcon closable>
          {str("No duplicate rows found")}
        </Message>,
        { placement: "topCenter", duration: 3000 },
      );
      return;
    }
    const dupSet = new Set(dupIndices);
    pushHistory();
    setRows((prev) => {
      const next = prev.filter((_, i) => !dupSet.has(i));
      return next.length ? next : [new Array(colCount).fill("")];
    });
    setSelection({
      anchor: { r: 0, c: 0 },
      focus: { r: 0, c: 0 },
      active: { r: 0, c: 0 },
    });
    toaster.push(
      <Message type="success" showIcon closable>
        {dupIndices.length} {str("duplicate rows removed")}
      </Message>,
      { placement: "topCenter", duration: 3000 },
    );
  }, [rows, colCount, pushHistory, str]);

  const trimWhitespaceAction = useCallback(() => {
    const { r1, r2, c1, c2 } = selRect;
    const wholeSheet = r1 === r2 && c1 === c2;
    const changes = [];
    if (wholeSheet) {
      for (let base = 0; base < rows.length; base++) {
        for (let c = 0; c < colCount; c++) {
          const v = rows[base][c];
          if (v == null) continue;
          const t = String(v).trim();
          if (t !== v) changes.push({ r: base, c, value: t });
        }
      }
    } else {
      for (let vr = r1; vr <= r2; vr++) {
        const base = viewOrder[vr];
        if (base == null) continue;
        for (let c = c1; c <= c2; c++) {
          const v = rows[base][c];
          if (v == null) continue;
          const t = String(v).trim();
          if (t !== v) changes.push({ r: base, c, value: t });
        }
      }
    }
    if (!changes.length) {
      toaster.push(
        <Message type="info" showIcon closable>
          {str("Nothing to trim")}
        </Message>,
        { placement: "topCenter", duration: 3000 },
      );
      return;
    }
    setCells(changes);
    toaster.push(
      <Message type="success" showIcon closable>
        {changes.length} {str("cells trimmed")}
      </Message>,
      { placement: "topCenter", duration: 3000 },
    );
  }, [selRect, rows, colCount, viewOrder, setCells, str]);

  const applySortToDataAction = useCallback(() => {
    if (!sort || hasFilters) return;
    pushHistory();
    setRows(viewOrder.map((i) => rows[i]));
    setSort(null);
    setSelection({
      anchor: { r: 0, c: 0 },
      focus: { r: 0, c: 0 },
      active: { r: 0, c: 0 },
    });
  }, [sort, hasFilters, viewOrder, rows, pushHistory]);

  const clearAllFiltersAction = useCallback(() => {
    setFilters({});
    setValueFilters({});
    setQuickFilter("");
  }, []);

  // ---- Find & Replace ----
  const findMatchList = useMemo(() => {
    if (!findOpen || !deferredFindQuery) return [];
    return findMatches(rows, viewOrder, colCount, deferredFindQuery, {
      matchCase: findMatchCase,
      wholeCell: findWholeCell,
    });
  }, [findOpen, deferredFindQuery, rows, viewOrder, colCount, findMatchCase, findWholeCell]);

  useEffect(() => {
    setFindActiveIndex(0);
  }, [deferredFindQuery, findMatchCase, findWholeCell, findOpen]);

  const navigateMatch = useCallback(
    (delta) => {
      if (!findMatchList.length) return;
      setFindActiveIndex((prev) => {
        const next = (prev + delta + findMatchList.length) % findMatchList.length;
        const m = findMatchList[next];
        setFocus(m.vr, m.c, false);
        return next;
      });
    },
    [findMatchList, setFocus],
  );

  const replaceOneAction = useCallback(() => {
    if (!findMatchList.length) return;
    const m = findMatchList[findActiveIndex % findMatchList.length];
    const base = viewOrder[m.vr];
    const current = rows[base]?.[m.c] ?? "";
    const next = replaceInCell(current, findQuery, findReplacement, {
      matchCase: findMatchCase,
      wholeCell: findWholeCell,
    });
    setCells([{ r: base, c: m.c, value: next }]);
  }, [
    findMatchList,
    findActiveIndex,
    viewOrder,
    rows,
    findQuery,
    findReplacement,
    findMatchCase,
    findWholeCell,
    setCells,
  ]);

  const replaceAllAction = useCallback(() => {
    if (!findMatchList.length) return;
    const changes = findMatchList.map((m) => {
      const base = viewOrder[m.vr];
      const current = rows[base]?.[m.c] ?? "";
      return {
        r: base,
        c: m.c,
        value: replaceInCell(current, findQuery, findReplacement, {
          matchCase: findMatchCase,
          wholeCell: findWholeCell,
        }),
      };
    });
    setCells(changes);
    toaster.push(
      <Message type="success" showIcon closable>
        {str("Replaced")} {changes.length} {str("occurrences")}
      </Message>,
      { placement: "topCenter", duration: 3000 },
    );
  }, [
    findMatchList,
    viewOrder,
    rows,
    findQuery,
    findReplacement,
    findMatchCase,
    findWholeCell,
    setCells,
    str,
  ]);

  // ---- Column menu value source ----
  const colMenuValueSource = useMemo(() => {
    if (!colMenu) return { values: [], hasBlanks: false };
    const col = colMenu.col;
    const q = quickFilter.trim().toLowerCase();
    const textFilterEntries = Object.entries(filters).filter(([, v]) => v);
    const values = [];
    let hasBlanks = false;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (q && !row.some((cell) => String(cell).toLowerCase().includes(q))) continue;
      let ok = true;
      for (const [fc, fv] of textFilterEntries) {
        if (!String(row[fc] ?? "").toLowerCase().includes(fv.toLowerCase())) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      for (const [fcStr, fset] of Object.entries(valueFilters)) {
        const fc = Number(fcStr);
        if (fc === col || !fset) continue;
        if (!fset.has(row[fc] == null ? "" : String(row[fc]))) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      const v = row[col] == null ? "" : String(row[col]);
      if (v === "") hasBlanks = true;
      else values.push(v);
    }
    return { values, hasBlanks };
  }, [colMenu, rows, filters, quickFilter, valueFilters]);

  const openColumnMenuFor = useCallback(
    (c) => {
      scrollCellIntoView(selection.active.r, c);
      requestAnimationFrame(() => {
        const el = headerRefs.current[c];
        const rect = el ? el.getBoundingClientRect() : null;
        if (rect) setColMenu({ col: c, x: rect.left, y: rect.bottom + 2 });
      });
    },
    [selection.active.r, scrollCellIntoView],
  );

  // ---- Pointer -> cell mapping (frozen-column aware) ----
  const pointerToCell = useCallback(
    (clientX, clientY) => {
      const el = scrollRef.current;
      const rect = el.getBoundingClientRect();
      const relX = clientX - rect.left - gutterW;
      const canvasX = relX < frozenWidth ? relX : relX + el.scrollLeft;
      const y = clientY - rect.top + el.scrollTop - headerTotal;
      const c = findCol(canvasX);
      const r = clamp(Math.floor(y / ROW_H), 0, Math.max(0, rowCount - 1));
      return { r, c };
    },
    [gutterW, headerTotal, findCol, rowCount, frozenWidth],
  );

  // ---- Mouse drag selection ----
  const onCellMouseDown = useCallback(
    (e, r, c) => {
      if (e.button === 2) {
        if (r < selRect.r1 || r > selRect.r2 || c < selRect.c1 || c > selRect.c2)
          setSelection({ anchor: { r, c }, focus: { r, c }, active: { r, c } });
        return;
      }
      if (editing) commitEdit(null);
      scrollRef.current?.focus();
      const extend = e.shiftKey;
      setSelection((prev) => ({
        anchor: extend ? prev.anchor : { r, c },
        focus: { r, c },
        active: { r, c },
      }));
      const onMove = (ev) => {
        const cell = pointerToCell(ev.clientX, ev.clientY);
        setSelection((prev) => ({ anchor: prev.anchor, focus: cell, active: cell }));
      };
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [editing, commitEdit, pointerToCell, selRect],
  );

  const onHeaderMouseDown = useCallback(
    (e, c) => {
      if (e.button !== 0) return;
      if (editing) commitEdit(null);
      scrollRef.current?.focus();
      setSelection((prev) => ({
        anchor: { r: 0, c: e.shiftKey ? prev.anchor.c : c },
        focus: { r: rowCount - 1, c },
        active: { r: 0, c },
      }));
      const onMove = (ev) => {
        const cell = pointerToCell(ev.clientX, ev.clientY);
        setSelection((prev) => ({
          anchor: { r: 0, c: prev.anchor.c },
          focus: { r: rowCount - 1, c: cell.c },
          active: { r: 0, c: cell.c },
        }));
      };
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [editing, commitEdit, rowCount, pointerToCell],
  );

  const onRowNumMouseDown = useCallback(
    (e, vr) => {
      if (e.button !== 0) return;
      if (editing) commitEdit(null);
      scrollRef.current?.focus();
      setSelection((prev) => ({
        anchor: { r: e.shiftKey ? prev.anchor.r : vr, c: 0 },
        focus: { r: vr, c: colCount - 1 },
        active: { r: vr, c: 0 },
      }));
      const onMove = (ev) => {
        const cell = pointerToCell(ev.clientX, ev.clientY);
        setSelection((prev) => ({
          anchor: { r: prev.anchor.r, c: 0 },
          focus: { r: cell.r, c: colCount - 1 },
          active: { r: cell.r, c: 0 },
        }));
      };
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [editing, commitEdit, colCount, pointerToCell],
  );

  const onFillMouseDown = useCallback(
    (e) => {
      e.stopPropagation();
      e.preventDefault();
      scrollRef.current?.focus();
      let last = null;
      const onMove = (ev) => {
        last = pointerToCell(ev.clientX, ev.clientY);
        setFillPreview(computeFillRect(selRect, last));
      };
      const onUp = () => {
        if (last) applyFill(last);
        setFillPreview(null);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [pointerToCell, applyFill, selRect],
  );

  // ---- Keyboard ----
  const onKeyDown = useCallback(
    (e) => {
      if (editing || renaming != null) return;
      const meta = e.ctrlKey || e.metaKey;
      const { r, c } = selection.active;
      const rect = selRect;
      const isBlock = rect.r2 > rect.r1 || rect.c2 > rect.c1;
      const pageRows = Math.max(1, Math.floor(viewport.height / ROW_H) - 1);

      if (meta && e.key.toLowerCase() === "g") {
        e.preventDefault();
        nameBoxRef.current?.focus();
        nameBoxRef.current?.select();
        return;
      }
      if (meta && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setFindOpen(true);
        setFindShowReplace(false);
        return;
      }
      if (meta && e.key.toLowerCase() === "h") {
        e.preventDefault();
        setFindOpen(true);
        setFindShowReplace(true);
        return;
      }
      if (meta && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSaveRef.current();
        return;
      }
      if (meta && e.shiftKey && e.key.toLowerCase() === "l") {
        e.preventDefault();
        setShowFilters((s) => !s);
        return;
      }
      if (e.altKey && e.key === "ArrowDown") {
        e.preventDefault();
        openColumnMenuFor(c);
        return;
      }
      if (meta && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setSelection({
          anchor: { r: 0, c: 0 },
          focus: { r: rowCount - 1, c: colCount - 1 },
          active: { r: 0, c: 0 },
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
      if (meta && e.key.toLowerCase() === "d") {
        e.preventDefault();
        fillDown();
        return;
      }
      if (meta && e.key.toLowerCase() === "r") {
        e.preventDefault();
        fillRight();
        return;
      }
      if (meta && e.key === "-") {
        e.preventDefault();
        deleteSelectionRowsOrCols();
        return;
      }
      if (meta && e.shiftKey && (e.key === "=" || e.key === "+")) {
        e.preventDefault();
        insertSelectionRowsOrCols();
        return;
      }
      if (meta && ARROW_DELTA[e.key]) {
        e.preventDefault();
        const [dr, dc] = ARROW_DELTA[e.key];
        const getValue = (rr, cc) => rows[viewOrder[rr]]?.[cc];
        const dest = dataEdge(getValue, r, c, dr, dc, rowCount, colCount);
        setFocus(dest.r, dest.c, e.shiftKey);
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setFocus(r + 1, c, e.shiftKey);
          return;
        case "ArrowUp":
          e.preventDefault();
          setFocus(r - 1, c, e.shiftKey);
          return;
        case "ArrowRight":
          e.preventDefault();
          setFocus(r, c + 1, e.shiftKey);
          return;
        case "ArrowLeft":
          e.preventDefault();
          setFocus(r, c - 1, e.shiftKey);
          return;
        case "Home":
          e.preventDefault();
          setFocus(r, 0, e.shiftKey);
          return;
        case "End":
          e.preventDefault();
          setFocus(r, colCount - 1, e.shiftKey);
          return;
        case "PageDown":
          e.preventDefault();
          setFocus(r + pageRows, c, e.shiftKey);
          return;
        case "PageUp":
          e.preventDefault();
          setFocus(r - pageRows, c, e.shiftKey);
          return;
        case " ":
          if (meta) {
            e.preventDefault();
            selectColumn(c, false);
          } else if (e.shiftKey) {
            e.preventDefault();
            selectRow(r, false);
          }
          return;
        case "Tab": {
          e.preventDefault();
          if (isBlock) {
            const next = advanceActiveInBlock(rect, selection.active, "col", e.shiftKey);
            setSelection((prev) => ({ ...prev, active: next }));
            scrollCellIntoView(next.r, next.c);
          } else {
            setFocus(r, c + (e.shiftKey ? -1 : 1), false);
          }
          return;
        }
        case "Enter": {
          e.preventDefault();
          if (isBlock) {
            const next = advanceActiveInBlock(rect, selection.active, "row", e.shiftKey);
            setSelection((prev) => ({ ...prev, active: next }));
            scrollCellIntoView(next.r, next.c);
          } else {
            setFocus(e.shiftKey ? r - 1 : r + 1, c, false);
          }
          return;
        }
        case "F2":
          e.preventDefault();
          startEdit(r, c, null, "edit");
          return;
        case "Delete":
        case "Backspace":
          e.preventDefault();
          clearSelection();
          return;
        case "Escape":
          e.preventDefault();
          e.stopPropagation();
          setCopied(null);
          return;
        default:
          if (e.key.length === 1 && !meta && !e.altKey) {
            e.preventDefault();
            startEdit(r, c, e.key, "enter");
          }
      }
    },
    [
      editing,
      renaming,
      selection,
      selRect,
      viewport.height,
      rowCount,
      colCount,
      rows,
      viewOrder,
      setFocus,
      startEdit,
      clearSelection,
      undo,
      redo,
      fillDown,
      fillRight,
      deleteSelectionRowsOrCols,
      insertSelectionRowsOrCols,
      openColumnMenuFor,
      selectColumn,
      selectRow,
      scrollCellIntoView,
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

  // ---- Selection statistics ----
  const stats = useMemo(() => {
    const { r1, r2, c1, c2 } = selRect;
    const total = (r2 - r1 + 1) * (c2 - c1 + 1);
    if (total > STATS_LIMIT) return { total, count: null };
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
  }, [selRect, rows, viewOrder]);

  // ---- Save ----
  const requestClose = useCallback(() => {
    if (headers !== savedHeadersRef.current || rows !== savedRowsRef.current) {
      setUnsavedDialogOpen(true);
    } else {
      onClose();
    }
  }, [headers, rows, onClose]);

  const handleSave = useCallback(() => {
    let outRows = rows;
    if (editing) {
      const base = viewOrder[editing.r];
      if (base != null && String(rows[base]?.[editing.c] ?? "") !== editValue) {
        outRows = rows.slice();
        const arr = outRows[base].slice();
        while (arr.length < colCount) arr.push("");
        arr[editing.c] = editValue;
        outRows[base] = arr;
      }
      setEditing(null);
    }
    const csv = serializeCsv(headers, outRows);
    savedHeadersRef.current = headers;
    savedRowsRef.current = outRows;
    onSave(csv);
    onClose();
  }, [editing, editValue, viewOrder, colCount, headers, rows, onSave, onClose]);

  // handleSave is referenced from the Ctrl+S handler above via a ref so the
  // (long) onKeyDown dependency list doesn't need to change every render.
  const handleSaveRef = useRef(handleSave);
  useEffect(() => {
    handleSaveRef.current = handleSave;
  }, [handleSave]);

  // ---- Render helpers ----
  const renderHeaderCells = () => {
    const cells = [];
    for (let c = 0; c < colCount; c++) {
      if (!isColVisible(c)) continue;
      const left = gutterW + colOffsets[c];
      const width = colWidths[c] || DEFAULT_COL_W;
      const isColSel = c >= selRect.c1 && c <= selRect.c2;
      const dir = sort && sort.col === c ? sort.dir : null;
      const isFilteredCol = !!valueFilters[c] || !!filters[c];
      const frozen = c < frozenColsClamped;
      cells.push(
        <div
          key={c}
          ref={(el) => {
            headerRefs.current[c] = el;
          }}
          className={`sheet-head-cell${isColSel ? " is-col-selected" : ""}${frozen ? " sheet-frozen" : ""}${
            frozen && c === frozenColsClamped - 1 ? " is-frozen-edge" : ""
          }`}
          style={{ position: frozen ? "sticky" : "absolute", left, width, height: HEADER_H }}
          data-testid={`sheet-head-${c}`}
          onMouseDown={(e) => onHeaderMouseDown(e, c)}
        >
          <span className="sheet-head-badge">{colLabel(c)}</span>
          {renaming === c ? (
            <input
              className="sheet-head-rename-input"
              value={renameValue}
              autoFocus
              data-testid={`sheet-head-rename-${c}`}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={commitRename}
              onMouseDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") commitRename();
                else if (e.key === "Escape") setRenaming(null);
              }}
            />
          ) : (
            <div
              className="sheet-head-name"
              title={headers[c]}
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
          <button
            type="button"
            className={`sheet-head-menu-btn${isFilteredCol ? " is-filtered" : ""}`}
            data-testid={`sheet-col-menu-${c}`}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              const btnRect = e.currentTarget.getBoundingClientRect();
              setColMenu({ col: c, x: btnRect.left, y: btnRect.bottom + 2 });
            }}
          >
            {isFilteredCol ? <Filter size={12} /> : <ChevronDown size={12} />}
          </button>
          <div
            className={`sheet-resize-handle${resizeRef.current === c ? " is-active" : ""}`}
            data-testid={`sheet-resize-${c}`}
            onMouseDown={(e) => onResizeMouseDown(e, c)}
            onDoubleClick={(e) => {
              e.stopPropagation();
              autoFitColumn(c);
            }}
          />
        </div>,
      );
    }
    return cells;
  };

  const renderFilterCells = () => {
    if (!showFilters) return null;
    const cells = [];
    for (let c = 0; c < colCount; c++) {
      if (!isColVisible(c)) continue;
      const left = gutterW + colOffsets[c];
      const width = colWidths[c] || DEFAULT_COL_W;
      const frozen = c < frozenColsClamped;
      cells.push(
        <div
          key={c}
          className={`sheet-filter-cell${frozen ? " sheet-frozen" : ""}${
            frozen && c === frozenColsClamped - 1 ? " is-frozen-edge" : ""
          }`}
          style={{ position: frozen ? "sticky" : "absolute", left, width, top: HEADER_H, height: FILTER_H }}
        >
          <input
            className="sheet-filter-input"
            placeholder={str("Filter")}
            value={filters[c] || ""}
            data-testid={`sheet-filter-${c}`}
            onChange={(e) => setFilters((prev) => ({ ...prev, [c]: e.target.value }))}
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
      for (let c = 0; c < colCount; c++) {
        if (!isColVisible(c)) continue;
        const left = gutterW + colOffsets[c];
        const width = colWidths[c] || DEFAULT_COL_W;
        const val = row[c] == null ? "" : row[c];
        const isEditing = editing && editing.r === vr && editing.c === c;
        const frozen = c < frozenColsClamped;
        cells.push(
          <div
            key={c}
            className={`sheet-cell${vr % 2 ? " is-alt" : ""}${frozen ? " sheet-frozen" : ""}${
              frozen && c === frozenColsClamped - 1 ? " is-frozen-edge" : ""
            }`}
            style={{ position: frozen ? "sticky" : "absolute", top: 0, left, width, height: ROW_H }}
            data-testid={`sheet-cell-${vr}-${c}`}
            onMouseDown={(e) => onCellMouseDown(e, vr, c)}
            onDoubleClick={() => startEdit(vr, c, null, "edit")}
          >
            {!isEditing && (
              <span className={`sheet-cell-text${isNumeric(val) ? " is-number" : ""}`}>{val}</span>
            )}
          </div>,
        );
      }
      els.push(
        <div key={base} className="sheet-row" style={{ top: vr * ROW_H, height: ROW_H, width: canvasW }}>
          <div
            className={`sheet-rownum${rowSel ? " is-row-selected" : ""}`}
            style={{ width: gutterW, height: ROW_H }}
            data-testid={`sheet-rownum-${vr}`}
            onMouseDown={(e) => onRowNumMouseDown(e, vr)}
          >
            {base + 1}
          </div>
          {cells}
        </div>,
      );
    }
    return els;
  };

  const overlays = useMemo(() => {
    if (!rowCount || !colCount) return null;
    const { r1, r2, c1, c2 } = selRect;
    const selStyle = {
      left: gutterW + colOffsets[c1],
      top: r1 * ROW_H,
      width: colOffsets[c2 + 1] - colOffsets[c1],
      height: (r2 - r1 + 1) * ROW_H,
    };
    const { r, c } = selection.active;
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
            style={{ left: gutterW + colOffsets[c2 + 1] - 4, top: (r2 + 1) * ROW_H - 4 }}
            onMouseDown={onFillMouseDown}
          />
        )}
        {copied && (
          <div
            className={`sheet-copied${copied.cut ? " is-cut" : ""}`}
            style={{
              left: gutterW + colOffsets[copied.c1],
              top: copied.r1 * ROW_H,
              width: colOffsets[copied.c2 + 1] - colOffsets[copied.c1],
              height: (copied.r2 - copied.r1 + 1) * ROW_H,
            }}
          />
        )}
        {fillPreview && (
          <div
            className="sheet-fill-preview"
            style={{
              left: gutterW + colOffsets[fillPreview.c1],
              top: fillPreview.r1 * ROW_H,
              width: colOffsets[fillPreview.c2 + 1] - colOffsets[fillPreview.c1],
              height: (fillPreview.r2 - fillPreview.r1 + 1) * ROW_H,
            }}
          />
        )}
      </>
    );
  }, [
    rowCount,
    colCount,
    selRect,
    selection.active,
    colOffsets,
    colWidths,
    gutterW,
    editing,
    copied,
    fillPreview,
    onFillMouseDown,
  ]);

  const editOverlay = useMemo(() => {
    if (!editing) return null;
    const frozen = editing.c < frozenColsClamped;
    const left = gutterW + colOffsets[editing.c];
    const top = headerTotal + editing.r * ROW_H;
    const width = Math.max(colWidths[editing.c] || DEFAULT_COL_W, 80);
    return (
      <input
        ref={editInputRef}
        className="sheet-cell-input"
        style={{
          position: frozen ? "sticky" : "absolute",
          left,
          top,
          width,
          height: ROW_H,
          zIndex: frozen ? 13 : 12,
        }}
        value={editValue}
        data-testid="sheet-cell-input"
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={(e) => {
          if (e.relatedTarget?.dataset?.testid === "sheet-formulabar-input") return;
          commitEdit(null);
        }}
        onKeyDown={editOverlayKeyDown}
      />
    );
  }, [
    editing,
    editValue,
    gutterW,
    colOffsets,
    colWidths,
    headerTotal,
    frozenColsClamped,
    commitEdit,
    editOverlayKeyDown,
  ]);

  const canUndo = pastRef.current.length > 0;
  const canRedo = futureRef.current.length > 0;
  const multiRowSel = selRect.r2 > selRect.r1;

  const activeBase = viewOrder[selection.active.r];
  const activeAddressLabel =
    activeBase != null ? `${colLabel(selection.active.c)}${activeBase + 1}` : "";
  const activeRawValue =
    activeBase != null ? String(rows[activeBase]?.[selection.active.c] ?? "") : "";
  const formulaBarValue = editing ? editValue : activeRawValue;

  return (
    <Drawer open={open} onClose={requestClose} size="full" keyboard={false}>
      <Drawer.Header>
        <Drawer.Title>
          <Trans>Edit CSV</Trans>: {fileName}
        </Drawer.Title>
        <Drawer.Actions>
          <Button onClick={requestClose} appearance="subtle" data-testid="sheet-cancel">
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
              <IconButton
                size="sm"
                icon={<Scissors size={16} />}
                appearance="subtle"
                onClick={() => doCut(null)}
                title={str("Cut")}
                data-testid="sheet-cut"
              />
              <IconButton
                size="sm"
                icon={<Copy size={16} />}
                appearance="subtle"
                onClick={() => doCopy(null)}
                title={str("Copy")}
                data-testid="sheet-copy"
              />
              <IconButton
                size="sm"
                icon={<ClipboardPaste size={16} />}
                appearance="subtle"
                onClick={() => doPaste(null)}
                title={str("Paste")}
                data-testid="sheet-paste"
              />
              <div className="sheet-toolbar-divider" />
              <Button size="sm" appearance="subtle" onClick={addRowEnd} data-testid="sheet-add-row">
                <Plus size={15} style={{ marginRight: 4 }} />
                <span className="sheet-toolbar-label">
                  <Trans>Add row</Trans>
                </span>
              </Button>
              <Button size="sm" appearance="subtle" onClick={addColumnEnd} data-testid="sheet-add-column">
                <Plus size={15} style={{ marginRight: 4 }} />
                <span className="sheet-toolbar-label">
                  <Trans>Add column</Trans>
                </span>
              </Button>
              <Dropdown
                trigger="click"
                placement="bottomStart"
                data-testid="sheet-insert-menu"
                title={
                  <span className="sheet-toolbar-dd-title">
                    <Plus size={14} />
                    <span className="sheet-toolbar-label">
                      <Trans>Insert</Trans>
                    </span>
                  </span>
                }
              >
                <Dropdown.Item data-testid="menu-insert-row-above" onClick={() => insertRowsAtSelection(true)}>
                  <Trans>Insert row above</Trans>
                </Dropdown.Item>
                <Dropdown.Item data-testid="menu-insert-row-below" onClick={() => insertRowsAtSelection(false)}>
                  <Trans>Insert row below</Trans>
                </Dropdown.Item>
                <Dropdown.Item data-testid="menu-insert-col-left" onClick={() => insertColumnsAtSelection(true)}>
                  <Trans>Insert column left</Trans>
                </Dropdown.Item>
                <Dropdown.Item data-testid="menu-insert-col-right" onClick={() => insertColumnsAtSelection(false)}>
                  <Trans>Insert column right</Trans>
                </Dropdown.Item>
              </Dropdown>
              <Dropdown
                trigger="click"
                placement="bottomStart"
                data-testid="sheet-delete-menu"
                title={
                  <span className="sheet-toolbar-dd-title">
                    <Trash2 size={14} />
                    <span className="sheet-toolbar-label">
                      <Trans>Delete</Trans>
                    </span>
                  </span>
                }
              >
                <Dropdown.Item
                  data-testid="sheet-delete-rows"
                  disabled={!multiRowSel && rowCount <= 1}
                  onClick={deleteRows}
                >
                  <Trans>Delete rows</Trans>
                </Dropdown.Item>
                <Dropdown.Item data-testid="sheet-delete-columns" disabled={colCount <= 1} onClick={deleteColumns}>
                  <Trans>Delete columns</Trans>
                </Dropdown.Item>
              </Dropdown>
              <div className="sheet-toolbar-divider" />
              <IconButton
                size="sm"
                icon={<Filter size={16} />}
                appearance={showFilters ? "primary" : "subtle"}
                onClick={() => setShowFilters((s) => !s)}
                title={str("Filters")}
                data-testid="sheet-toggle-filters"
              />
              <Dropdown
                trigger="click"
                placement="bottomStart"
                data-testid="sheet-freeze-menu"
                title={
                  <span className="sheet-toolbar-dd-title">
                    <Pin size={14} />
                    <span className="sheet-toolbar-label">
                      <Trans>Freeze</Trans>
                    </span>
                  </span>
                }
              >
                <Dropdown.Item data-testid="menu-freeze-first" onClick={() => setFrozenCols(1)}>
                  <Trans>Freeze first column</Trans>
                </Dropdown.Item>
                <Dropdown.Item
                  data-testid="menu-freeze-here"
                  disabled={selection.active.c >= colCount - 1}
                  onClick={() => setFrozenCols(selection.active.c + 1)}
                >
                  <Trans>Freeze up to this column</Trans>
                </Dropdown.Item>
                <Dropdown.Item data-testid="menu-unfreeze" disabled={frozenCols === 0} onClick={() => setFrozenCols(0)}>
                  <Trans>Unfreeze columns</Trans>
                </Dropdown.Item>
              </Dropdown>
              <Dropdown
                trigger="click"
                placement="bottomStart"
                data-testid="sheet-data-menu"
                title={
                  <span className="sheet-toolbar-dd-title">
                    <Wand2 size={14} />
                    <span className="sheet-toolbar-label">
                      <Trans>Data</Trans>
                    </span>
                  </span>
                }
              >
                <Dropdown.Item data-testid="menu-remove-duplicates" onClick={removeDuplicateRowsAction}>
                  <Trans>Remove duplicate rows</Trans>
                </Dropdown.Item>
                <Dropdown.Item data-testid="menu-trim-whitespace" onClick={trimWhitespaceAction}>
                  <Trans>Trim whitespace</Trans>
                </Dropdown.Item>
                <Dropdown.Item data-testid="menu-apply-sort" disabled={!sort || hasFilters} onClick={applySortToDataAction}>
                  <Trans>Apply sort to data</Trans>
                </Dropdown.Item>
                <Dropdown.Item data-testid="menu-clear-filters" disabled={!hasFilters} onClick={clearAllFiltersAction}>
                  <Trans>Clear all filters</Trans>
                </Dropdown.Item>
              </Dropdown>
              <IconButton
                size="sm"
                icon={<Search size={16} />}
                appearance={findOpen ? "primary" : "subtle"}
                onClick={() => setFindOpen((s) => !s)}
                title={str("Find")}
                data-testid="sheet-find-toggle"
              />
              {sort && (
                <div className="sheet-sort-chip" data-testid="sheet-sort-chip">
                  <Trans>Sorted by</Trans> <strong>{headers[sort.col]}</strong>
                  {sort.dir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                  <button
                    type="button"
                    className="sheet-sort-chip-apply"
                    disabled={hasFilters}
                    title={hasFilters ? str("Clear filters to apply sort to data") : undefined}
                    onClick={applySortToDataAction}
                    data-testid="sheet-apply-sort"
                  >
                    <Trans>Apply</Trans>
                  </button>
                  <button
                    type="button"
                    className="sheet-sort-chip-clear"
                    onClick={() => setSort(null)}
                    data-testid="sheet-clear-sort"
                  >
                    ×
                  </button>
                </div>
              )}
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

            <FormulaBar
              nameBoxRef={nameBoxRef}
              addressLabel={activeAddressLabel}
              value={formulaBarValue}
              onNameJump={(input) => {
                const addr = parseAddress(input);
                if (!addr) {
                  toaster.push(
                    <Message type="warning" showIcon closable>
                      {str("Invalid reference")}
                    </Message>,
                    { placement: "topCenter" },
                  );
                  return;
                }
                const r1 = clamp(addr.r1, 0, Math.max(0, rowCount - 1));
                const r2 = clamp(addr.r2, 0, Math.max(0, rowCount - 1));
                const c1 = clamp(addr.c1, 0, Math.max(0, colCount - 1));
                const c2 = clamp(addr.c2, 0, Math.max(0, colCount - 1));
                setSelection({ anchor: { r: r1, c: c1 }, focus: { r: r2, c: c2 }, active: { r: r1, c: c1 } });
                scrollCellIntoView(r1, c1);
                scrollRef.current?.focus();
              }}
              onFocusContent={() => {
                if (!editing) startEdit(selection.active.r, selection.active.c, null, "edit");
              }}
              onChangeContent={(v) => setEditValue(v)}
              onCommitContent={(move) => commitEdit(move)}
              onCancelContent={() => cancelEdit()}
              onBlurContent={() => commitEdit(null)}
            />

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
                  <div className="sheet-header" style={{ width: canvasW, height: headerTotal }}>
                    <div
                      className="sheet-corner"
                      style={{ width: gutterW, height: headerTotal }}
                      data-testid="sheet-select-all"
                      onClick={() =>
                        setSelection({
                          anchor: { r: 0, c: 0 },
                          focus: { r: rowCount - 1, c: colCount - 1 },
                          active: { r: 0, c: 0 },
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

              {findOpen && (
                <FindReplacePanel
                  showReplace={findShowReplace}
                  onToggleReplace={() => setFindShowReplace((s) => !s)}
                  query={findQuery}
                  onQueryChange={setFindQuery}
                  replacement={findReplacement}
                  onReplacementChange={setFindReplacement}
                  matchCase={findMatchCase}
                  onMatchCaseChange={setFindMatchCase}
                  wholeCell={findWholeCell}
                  onWholeCellChange={setFindWholeCell}
                  matchCount={findMatchList.length}
                  matchIndex={findMatchList.length ? findActiveIndex % findMatchList.length : -1}
                  onNavigate={navigateMatch}
                  onReplaceOne={replaceOneAction}
                  onReplaceAll={replaceAllAction}
                  onClose={() => setFindOpen(false)}
                />
              )}
            </div>

            <div className="sheet-statusbar" data-testid="sheet-statusbar">
              <span>
                <strong>{rowCount}</strong> <Trans>rows</Trans>
                {hasFilters && rows.length !== rowCount ? ` / ${rows.length}` : ""}
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
                        <Trans>Sum</Trans>: <strong>{Number(stats.sum.toFixed(4)).toLocaleString()}</strong>
                      </span>
                      <span>
                        <Trans>Average</Trans>:{" "}
                        <strong>{Number((stats.sum / stats.numCount).toFixed(4)).toLocaleString()}</strong>
                      </span>
                      <span>
                        <Trans>Min</Trans>: <strong>{Number(stats.min.toFixed(4)).toLocaleString()}</strong>
                      </span>
                      <span>
                        <Trans>Max</Trans>: <strong>{Number(stats.max.toFixed(4)).toLocaleString()}</strong>
                      </span>
                    </>
                  )}
                </>
              )}
              <span data-testid="sheet-active-address">{activeAddressLabel}</span>
            </div>

            {contextMenu && (
              <FloatingMenu
                x={contextMenu.x}
                y={contextMenu.y}
                onClose={() => setContextMenu(null)}
                className="sheet-context-menu"
                testId="sheet-context-menu"
              >
                <div className="sheet-context-item" data-testid="ctx-copy" onClick={() => { doCopy(null); setContextMenu(null); }}>
                  <Copy size={15} /> <Trans>Copy</Trans>
                  <span className="sheet-context-shortcut">Ctrl+C</span>
                </div>
                <div className="sheet-context-item" data-testid="ctx-cut" onClick={() => { doCut(null); setContextMenu(null); }}>
                  <Scissors size={15} /> <Trans>Cut</Trans>
                  <span className="sheet-context-shortcut">Ctrl+X</span>
                </div>
                <div className="sheet-context-item" data-testid="ctx-paste" onClick={() => { doPaste(null); setContextMenu(null); }}>
                  <ClipboardPaste size={15} /> <Trans>Paste</Trans>
                  <span className="sheet-context-shortcut">Ctrl+V</span>
                </div>
                <div className="sheet-context-sep" />
                <div
                  className="sheet-context-item"
                  data-testid="ctx-insert-row-above"
                  onClick={() => { insertRows(viewOrder[selRect.r1], 1); setContextMenu(null); }}
                >
                  <Trans>Insert row above</Trans>
                </div>
                <div
                  className="sheet-context-item"
                  data-testid="ctx-insert-row-below"
                  onClick={() => { insertRows(viewOrder[selRect.r2] + 1, 1); setContextMenu(null); }}
                >
                  <Trans>Insert row below</Trans>
                </div>
                <div
                  className="sheet-context-item"
                  data-testid="ctx-insert-col-left"
                  onClick={() => { insertColumns(selRect.c1, 1); setContextMenu(null); }}
                >
                  <Trans>Insert column left</Trans>
                </div>
                <div
                  className="sheet-context-item"
                  data-testid="ctx-insert-col-right"
                  onClick={() => { insertColumns(selRect.c2 + 1, 1); setContextMenu(null); }}
                >
                  <Trans>Insert column right</Trans>
                </div>
                <div className="sheet-context-sep" />
                <div
                  className="sheet-context-item"
                  data-testid="ctx-filter-by-value"
                  onClick={() => {
                    const base = viewOrder[selection.active.r];
                    const v = base != null ? String(rows[base]?.[selection.active.c] ?? "") : "";
                    setValueFilters((prev) => ({ ...prev, [selection.active.c]: new Set([v]) }));
                    setContextMenu(null);
                  }}
                >
                  <Filter size={15} /> <Trans>Filter by value</Trans>
                </div>
                <div
                  className="sheet-context-item"
                  data-testid="ctx-freeze"
                  onClick={() => { setFrozenCols(selection.active.c + 1); setContextMenu(null); }}
                >
                  <Pin size={15} /> <Trans>Freeze up to this column</Trans>
                </div>
                <div className="sheet-context-sep" />
                <div
                  className="sheet-context-item"
                  data-testid="ctx-sort-asc"
                  onClick={() => { setSort({ col: selection.active.c, dir: "asc" }); setContextMenu(null); }}
                >
                  <ArrowUp size={15} /> <Trans>Sort ascending</Trans>
                </div>
                <div
                  className="sheet-context-item"
                  data-testid="ctx-sort-desc"
                  onClick={() => { setSort({ col: selection.active.c, dir: "desc" }); setContextMenu(null); }}
                >
                  <ArrowDown size={15} /> <Trans>Sort descending</Trans>
                </div>
                <div className="sheet-context-sep" />
                <div
                  className="sheet-context-item is-danger"
                  data-testid="ctx-clear"
                  onClick={() => { clearSelection(); setContextMenu(null); }}
                >
                  <Trans>Clear contents</Trans>
                </div>
                <div
                  className="sheet-context-item is-danger"
                  data-testid="ctx-delete-rows"
                  onClick={() => { deleteRows(); setContextMenu(null); }}
                >
                  <Trash2 size={15} /> <Trans>Delete rows</Trans>
                </div>
                <div
                  className="sheet-context-item is-danger"
                  data-testid="ctx-delete-cols"
                  onClick={() => { deleteColumns(); setContextMenu(null); }}
                >
                  <Trans>Delete columns</Trans>
                </div>
              </FloatingMenu>
            )}

            {colMenu && (
              <ColumnMenu
                x={colMenu.x}
                y={colMenu.y}
                onClose={() => setColMenu(null)}
                colIndex={colMenu.col}
                columnLabel={headers[colMenu.col]}
                sortDir={sort && sort.col === colMenu.col ? sort.dir : null}
                isFrozen={colMenu.col < frozenColsClamped}
                colCount={colCount}
                allValues={colMenuValueSource.values}
                hasBlanks={colMenuValueSource.hasBlanks}
                selected={valueFilters[colMenu.col] ?? null}
                onSort={(dir) => setSort({ col: colMenu.col, dir })}
                onClearSort={() => setSort(null)}
                onApplyFilter={(set) => {
                  setValueFilters((prev) => {
                    if (set == null) {
                      const next = { ...prev };
                      delete next[colMenu.col];
                      return next;
                    }
                    return { ...prev, [colMenu.col]: set };
                  });
                }}
                onClearFilter={() =>
                  setValueFilters((prev) => {
                    const next = { ...prev };
                    delete next[colMenu.col];
                    return next;
                  })
                }
                onRename={() => {
                  setRenaming(colMenu.col);
                  setRenameValue(headers[colMenu.col]);
                }}
                onAutoFit={() => autoFitColumn(colMenu.col)}
                onFreezeHere={() => setFrozenCols(colMenu.col + 1)}
                onFreezeFirst={() => setFrozenCols(1)}
                onUnfreeze={() => setFrozenCols(0)}
              />
            )}
          </div>
        )}
      </Drawer.Body>

      <Modal open={unsavedDialogOpen} onClose={() => setUnsavedDialogOpen(false)} size="xs" data-testid="sheet-unsaved-dialog">
        <Modal.Header>
          <Modal.Title>
            <Trans>Unsaved changes</Trans>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Trans>You have unsaved changes. Save them before closing?</Trans>
        </Modal.Body>
        <Modal.Footer>
          <Button
            appearance="primary"
            onClick={() => {
              setUnsavedDialogOpen(false);
              handleSave();
            }}
            data-testid="sheet-unsaved-save"
          >
            <Trans>Save</Trans>
          </Button>
          <Button
            appearance="subtle"
            color="red"
            onClick={() => {
              setUnsavedDialogOpen(false);
              onClose();
            }}
            data-testid="sheet-unsaved-discard"
          >
            <Trans>Discard</Trans>
          </Button>
          <Button appearance="subtle" onClick={() => setUnsavedDialogOpen(false)} data-testid="sheet-unsaved-cancel">
            <Trans>Cancel</Trans>
          </Button>
        </Modal.Footer>
      </Modal>
    </Drawer>
  );
};

export default SpreadsheetEditor;
