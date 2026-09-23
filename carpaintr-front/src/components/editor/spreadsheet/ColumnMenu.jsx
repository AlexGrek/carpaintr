import { useMemo, useState } from "react";
import { Button, Checkbox, Input, InputGroup } from "rsuite";
import { ArrowUp, ArrowDown, Search, Pin, PinOff } from "lucide-react";
import FloatingMenu from "./FloatingMenu";
import { useLocale } from "../../../localization/LocaleContext";
import Trans from "../../../localization/Trans";

const VALUE_LIST_LIMIT = 500;

/**
 * Excel-style AutoFilter dropdown for a column header: sort, a value
 * checklist filter (search + select-all + blanks), plus rename / auto-fit /
 * freeze shortcuts. All translations it needs are registered once in
 * `SpreadsheetEditor.jsx` (shared global hashtable — see CLAUDE.md).
 */
const ColumnMenu = ({
  x,
  y,
  onClose,
  colIndex,
  columnLabel,
  sortDir,
  isFrozen,
  colCount,
  allValues, // string[] of every value currently visible under other filters
  hasBlanks,
  selected, // Set<string> | null (null = no filter / everything checked)
  onSort,
  onClearSort,
  onApplyFilter,
  onClearFilter,
  onRename,
  onAutoFit,
  onFreezeHere,
  onFreezeFirst,
  onUnfreeze,
}) => {
  const { str } = useLocale();
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState(() => selected);

  const uniqueValues = useMemo(() => {
    const set = new Set(allValues);
    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true }),
    );
  }, [allValues]);

  const filteredValues = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return uniqueValues;
    return uniqueValues.filter((v) => v.toLowerCase().includes(q));
  }, [uniqueValues, search]);

  const shown = filteredValues.slice(0, VALUE_LIST_LIMIT);
  const hiddenCount = filteredValues.length - shown.length;

  const blanksVisible = hasBlanks && !search.trim();
  const isChecked = (v) => pending == null || pending.has(v);
  const allShownChecked = shown.every(isChecked) && (!blanksVisible || isChecked(""));

  const toggleValue = (v, checked) => {
    setPending((prev) => {
      const next = prev == null ? new Set(uniqueValues.concat(hasBlanks ? [""] : [])) : new Set(prev);
      if (checked) next.add(v);
      else next.delete(v);
      return next;
    });
  };

  // Scoped to the currently searched/visible values, matching Excel:
  // narrowing the search and toggling this doesn't touch selection state
  // for values the search has hidden.
  const toggleSelectAll = (checked) => {
    setPending((prev) => {
      const next = prev == null ? new Set(uniqueValues.concat(hasBlanks ? [""] : [])) : new Set(prev);
      for (const v of shown) {
        if (checked) next.add(v);
        else next.delete(v);
      }
      if (blanksVisible) {
        if (checked) next.add("");
        else next.delete("");
      }
      return next;
    });
  };

  const apply = () => {
    onApplyFilter(pending);
    onClose();
  };

  return (
    <FloatingMenu x={x} y={y} onClose={onClose} className="sheet-colmenu" testId={`sheet-colmenu-${colIndex}`}>
      <div className="sheet-colmenu-title">{columnLabel}</div>
      <div
        className="sheet-context-item"
        data-testid={`colmenu-sort-asc-${colIndex}`}
        onClick={() => {
          onSort("asc");
          onClose();
        }}
      >
        <ArrowUp size={14} /> <Trans>Sort ascending</Trans>
        {sortDir === "asc" && <span className="sheet-colmenu-check">✓</span>}
      </div>
      <div
        className="sheet-context-item"
        data-testid={`colmenu-sort-desc-${colIndex}`}
        onClick={() => {
          onSort("desc");
          onClose();
        }}
      >
        <ArrowDown size={14} /> <Trans>Sort descending</Trans>
        {sortDir === "desc" && <span className="sheet-colmenu-check">✓</span>}
      </div>
      {sortDir && (
        <div
          className="sheet-context-item"
          data-testid={`colmenu-clear-sort-${colIndex}`}
          onClick={() => {
            onClearSort();
            onClose();
          }}
        >
          <Trans>Clear sort</Trans>
        </div>
      )}
      <div className="sheet-context-sep" />

      <InputGroup size="xs" className="sheet-colmenu-search">
        <Input
          placeholder={str("Search values…")}
          value={search}
          onChange={setSearch}
          data-testid={`colmenu-search-${colIndex}`}
        />
        <InputGroup.Addon>
          <Search size={13} />
        </InputGroup.Addon>
      </InputGroup>

      <div className="sheet-colmenu-values" data-testid={`colmenu-values-${colIndex}`}>
        <Checkbox
          checked={allShownChecked}
          indeterminate={!allShownChecked && shown.some(isChecked)}
          onChange={(_, checked) => toggleSelectAll(checked)}
          data-testid={`colmenu-select-all-${colIndex}`}
        >
          <Trans>Select all</Trans>
        </Checkbox>
        {blanksVisible && (
          <Checkbox
            checked={isChecked("")}
            onChange={(_, checked) => toggleValue("", checked)}
            data-testid={`colmenu-blanks-${colIndex}`}
          >
            <Trans>(Blanks)</Trans>
          </Checkbox>
        )}
        {shown.map((v) => (
          <Checkbox
            key={v}
            checked={isChecked(v)}
            onChange={(_, checked) => toggleValue(v, checked)}
            data-testid={`colmenu-value-${colIndex}`}
          >
            <span className="sheet-colmenu-value-text" title={v}>
              {v}
            </span>
          </Checkbox>
        ))}
        {hiddenCount > 0 && (
          <div className="sheet-colmenu-more">
            <strong>{hiddenCount}</strong> <Trans>more — refine search</Trans>
          </div>
        )}
      </div>

      <div className="sheet-colmenu-actions">
        <Button size="xs" appearance="primary" onClick={apply} data-testid={`colmenu-ok-${colIndex}`}>
          OK
        </Button>
        <Button size="xs" appearance="subtle" onClick={onClose} data-testid={`colmenu-cancel-${colIndex}`}>
          <Trans>Cancel</Trans>
        </Button>
        {selected != null && (
          <Button
            size="xs"
            appearance="link"
            onClick={() => {
              onClearFilter();
              onClose();
            }}
            data-testid={`colmenu-clear-filter-${colIndex}`}
          >
            <Trans>Clear filter</Trans>
          </Button>
        )}
      </div>

      <div className="sheet-context-sep" />
      <div
        className="sheet-context-item"
        data-testid={`colmenu-rename-${colIndex}`}
        onClick={() => {
          onRename();
          onClose();
        }}
      >
        <Trans>Rename column</Trans>
      </div>
      <div
        className="sheet-context-item"
        data-testid={`colmenu-autofit-${colIndex}`}
        onClick={() => {
          onAutoFit();
          onClose();
        }}
      >
        <Trans>Auto-fit column width</Trans>
      </div>
      {isFrozen ? (
        <div
          className="sheet-context-item"
          data-testid={`colmenu-unfreeze-${colIndex}`}
          onClick={() => {
            onUnfreeze();
            onClose();
          }}
        >
          <PinOff size={14} /> <Trans>Unfreeze columns</Trans>
        </div>
      ) : (
        colIndex === 0 ? (
          <div
            className="sheet-context-item"
            data-testid={`colmenu-freeze-first-${colIndex}`}
            onClick={() => {
              onFreezeFirst();
              onClose();
            }}
          >
            <Pin size={14} /> <Trans>Freeze first column</Trans>
          </div>
        ) : (
          colIndex < colCount - 1 && (
            <div
              className="sheet-context-item"
              data-testid={`colmenu-freeze-here-${colIndex}`}
              onClick={() => {
                onFreezeHere();
                onClose();
              }}
            >
              <Pin size={14} /> <Trans>Freeze up to this column</Trans>
            </div>
          )
        )
      )}
    </FloatingMenu>
  );
};

export default ColumnMenu;
