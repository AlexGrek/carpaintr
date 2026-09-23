import { useEffect, useState } from "react";

/**
 * Excel-style name box + cell content bar above the grid. The name box
 * accepts an address ("B12") or range ("A1:C5") and jumps/selects on Enter;
 * the content input mirrors the active cell and shares the same `editValue`
 * state as the in-grid cell editor, so typing in either one is equivalent to
 * typing in the other.
 */
const FormulaBar = ({
  nameBoxRef,
  addressLabel,
  value,
  onNameJump,
  onFocusContent,
  onChangeContent,
  onCommitContent,
  onCancelContent,
  onBlurContent,
}) => {
  const [nameValue, setNameValue] = useState(addressLabel);

  useEffect(() => {
    setNameValue(addressLabel);
  }, [addressLabel]);

  return (
    <div className="sheet-formulabar" data-testid="sheet-formulabar">
      <input
        ref={nameBoxRef}
        className="sheet-namebox"
        value={nameValue}
        data-testid="sheet-namebox"
        onChange={(e) => setNameValue(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") {
            e.preventDefault();
            onNameJump(nameValue);
            e.currentTarget.blur();
          } else if (e.key === "Escape") {
            e.preventDefault();
            setNameValue(addressLabel);
            e.currentTarget.blur();
          }
        }}
        onBlur={() => setNameValue(addressLabel)}
      />
      <span className="sheet-formulabar-fx">fx</span>
      <input
        className="sheet-formulabar-content"
        value={value}
        data-testid="sheet-formulabar-input"
        onFocus={onFocusContent}
        onChange={(e) => onChangeContent(e.target.value)}
        onBlur={(e) => {
          if (e.relatedTarget?.dataset?.testid === "sheet-cell-input") return;
          onBlurContent?.();
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") {
            e.preventDefault();
            onCommitContent({ dr: e.shiftKey ? -1 : 1, dc: 0 });
          } else if (e.key === "Tab") {
            e.preventDefault();
            onCommitContent({ dr: 0, dc: e.shiftKey ? -1 : 1 });
          } else if (e.key === "Escape") {
            e.preventDefault();
            onCancelContent();
          }
        }}
      />
    </div>
  );
};

export default FormulaBar;
