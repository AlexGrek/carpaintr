import { useMemo, useRef, useState } from "react";
import { Search, Plus, X } from "lucide-react";
import SelectedValueRow from "./SelectedValueRow";

// Normalize for fuzzy-ish matching: "CX 5", "cx-5" and "cx5" all match each other
const normalize = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");

/**
 * Search field with an always-visible scrollable list of options.
 * Empty query shows all items; typing filters them. When the query doesn't
 * match an item exactly, a "use as entered" option allows a custom value.
 *
 * onChange(value, isCustom) — value is null when the selection is cleared.
 * Items may carry an optional `media` node (e.g. a thumbnail) shown before the label.
 */
const SearchSelectInput = ({
  items = [],
  value = null,
  onChange,
  placeholder = "",
  customOptionLabel = (text) => `"${text}"`,
  customSelectedHint = "",
  changeLabel = "Change",
  emptyText = "",
  maxListHeight = 280,
  testId,
}) => {
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const normalizedItems = useMemo(
    () =>
      items.map((item) =>
        typeof item === "string" ? { value: item, label: item } : item,
      ),
    [items],
  );

  const trimmed = query.trim();
  const needle = normalize(trimmed);

  const filtered = useMemo(
    () =>
      needle
        ? normalizedItems.filter(
            (item) =>
              normalize(item.label).includes(needle) ||
              normalize(item.value).includes(needle),
          )
        : normalizedItems,
    [normalizedItems, needle],
  );

  const exactMatch = needle
    ? normalizedItems.find(
        (item) =>
          normalize(item.value) === needle || normalize(item.label) === needle,
      )
    : null;
  const showCustom = trimmed.length > 0 && !exactMatch;

  // Options in display order: matches first, custom entry last
  const options = showCustom
    ? [...filtered, { value: trimmed, label: trimmed, custom: true }]
    : filtered;

  const select = (option) => {
    setQuery("");
    setHighlighted(0);
    onChange?.(option.value, !!option.custom);
  };

  const scrollToIndex = (index) => {
    const el = listRef.current?.children[index];
    el?.scrollIntoView({ block: "nearest" });
  };

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (options.length === 0) return;
      const delta = e.key === "ArrowDown" ? 1 : -1;
      const next = (highlighted + delta + options.length) % options.length;
      setHighlighted(next);
      scrollToIndex(next);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (exactMatch) {
        select(exactMatch);
      } else if (options[highlighted]) {
        select(options[highlighted]);
      }
    } else if (e.key === "Escape") {
      setQuery("");
      setHighlighted(0);
    }
  };

  const selectedItem =
    value !== null
      ? normalizedItems.find((item) => item.value === value) ?? {
          value,
          label: value,
          custom: true,
        }
      : null;

  if (selectedItem) {
    return (
      <SelectedValueRow
        media={selectedItem.media}
        label={selectedItem.label}
        hint={selectedItem.custom ? customSelectedHint : null}
        changeLabel={changeLabel}
        onClick={() => onChange?.(null, false)}
        testId={testId ? `${testId}-selected` : undefined}
      />
    );
  }

  return (
    <div
      className="overflow-hidden rounded-xl border border-slate-200 bg-white transition-shadow focus-within:border-blue-500 focus-within:ring-[3px] focus-within:ring-blue-500/15"
      data-testid={testId}
    >
      <div className="flex h-11 items-center gap-2 border-b border-slate-100 px-3">
        <Search size={16} className="shrink-0 text-slate-400" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlighted(0);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          // text-base (16px) prevents iOS zoom on focus
          className="min-w-0 flex-1 bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-400"
          autoComplete="off"
          data-testid={testId ? `${testId}-input` : undefined}
        />
        {query && (
          <button
            type="button"
            className="shrink-0 text-slate-400 hover:text-slate-600"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
          >
            <X size={16} />
          </button>
        )}
      </div>
      <div
        ref={listRef}
        className="overflow-y-auto overscroll-contain"
        style={{ maxHeight: `${maxListHeight}px` }}
        role="listbox"
      >
        {options.length === 0 && emptyText && (
          <div className="px-3 py-3 text-sm text-slate-400">{emptyText}</div>
        )}
        {options.map((option, index) => (
          <div
            key={option.custom ? "__custom__" : option.value}
            role="option"
            aria-selected={index === highlighted}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => select(option)}
            onMouseEnter={() => setHighlighted(index)}
            className={`flex cursor-pointer items-center gap-2 border-b border-slate-100 px-3 py-2.5 text-sm last:border-b-0 ${
              option.custom ? "font-medium text-blue-600" : "text-slate-700"
            } ${index === highlighted ? "bg-slate-50" : "bg-white"}`}
            data-testid={
              testId
                ? option.custom
                  ? `${testId}-custom`
                  : `${testId}-option-${String(option.value)}`
                : undefined
            }
          >
            {option.custom ? (
              <>
                <Plus size={16} className="shrink-0" />
                <span>{customOptionLabel(option.label)}</span>
              </>
            ) : (
              <>
                {option.media && (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md">
                    {option.media}
                  </span>
                )}
                <span>{option.label}</span>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SearchSelectInput;
