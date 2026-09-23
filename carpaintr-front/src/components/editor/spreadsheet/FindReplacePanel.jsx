import { Button, Checkbox, IconButton, Input, InputGroup } from "rsuite";
import { ChevronUp, ChevronDown, X } from "lucide-react";
import { useLocale } from "../../../localization/LocaleContext";
import Trans from "../../../localization/Trans";

/**
 * Floating Find & Replace panel (Ctrl+F / Ctrl+H). Stays open across
 * navigation — closed only via the X button or Escape — so repeated
 * "find next" / "replace" clicks work the way Excel's dialog does.
 */
const FindReplacePanel = ({
  showReplace,
  onToggleReplace,
  query,
  onQueryChange,
  replacement,
  onReplacementChange,
  matchCase,
  onMatchCaseChange,
  wholeCell,
  onWholeCellChange,
  matchCount,
  matchIndex, // 0-based index of the active match, or -1
  onNavigate, // (delta) => void
  onReplaceOne,
  onReplaceAll,
  onClose,
}) => {
  const { str } = useLocale();

  const handleKeyDown = (e) => {
    e.stopPropagation();
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "Enter") {
      e.preventDefault();
      onNavigate(e.shiftKey ? -1 : 1);
    }
  };

  return (
    <div className="sheet-findpanel" data-testid="sheet-findpanel" onKeyDown={handleKeyDown}>
      <div className="sheet-findpanel-row">
        <InputGroup size="sm" className="sheet-findpanel-input">
          <Input
            autoFocus
            placeholder={str("Find")}
            value={query}
            onChange={onQueryChange}
            data-testid="find-query-input"
          />
        </InputGroup>
        <span className="sheet-findpanel-count" data-testid="find-match-count">
          {query
            ? matchCount > 0
              ? `${matchIndex + 1} / ${matchCount}`
              : str("No matches")
            : ""}
        </span>
        <IconButton
          size="sm"
          icon={<ChevronUp size={15} />}
          appearance="subtle"
          disabled={matchCount === 0}
          onClick={() => onNavigate(-1)}
          data-testid="find-prev"
        />
        <IconButton
          size="sm"
          icon={<ChevronDown size={15} />}
          appearance="subtle"
          disabled={matchCount === 0}
          onClick={() => onNavigate(1)}
          data-testid="find-next"
        />
        <IconButton
          size="sm"
          icon={<X size={15} />}
          appearance="subtle"
          onClick={onClose}
          data-testid="find-close"
        />
      </div>

      {showReplace && (
        <div className="sheet-findpanel-row">
          <InputGroup size="sm" className="sheet-findpanel-input">
            <Input
              placeholder={str("Replace")}
              value={replacement}
              onChange={onReplacementChange}
              data-testid="find-replace-input"
            />
          </InputGroup>
          <Button
            size="sm"
            appearance="subtle"
            disabled={matchCount === 0}
            onClick={onReplaceOne}
            data-testid="find-replace-one"
          >
            <Trans>Replace</Trans>
          </Button>
          <Button
            size="sm"
            appearance="subtle"
            disabled={matchCount === 0}
            onClick={onReplaceAll}
            data-testid="find-replace-all"
          >
            <Trans>Replace all</Trans>
          </Button>
        </div>
      )}

      <div className="sheet-findpanel-row sheet-findpanel-options">
        <Checkbox checked={matchCase} onChange={(_, c) => onMatchCaseChange(c)} data-testid="find-match-case">
          <Trans>Match case</Trans>
        </Checkbox>
        <Checkbox checked={wholeCell} onChange={(_, c) => onWholeCellChange(c)} data-testid="find-whole-cell">
          <Trans>Match entire cell contents</Trans>
        </Checkbox>
        <button
          type="button"
          className="sheet-findpanel-toggle-replace"
          data-testid="find-toggle-replace"
          onClick={onToggleReplace}
        >
          {showReplace ? "▲" : "▼"} <Trans>Replace</Trans>
        </button>
      </div>
    </div>
  );
};

export default FindReplacePanel;
