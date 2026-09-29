import { ArrowLeftRight } from "lucide-react";
import "./PickerControls.css";

/**
 * Collapsed "current choice" row: optional media, label (+ hint) and a
 * "Change" pill. Clicking anywhere on the row reopens the choice.
 */
const SelectedValueRow = ({
  media,
  label,
  hint,
  changeLabel = "Change",
  onClick,
  testId,
  labelTestId,
  changeTestId,
}) => (
  <button
    type="button"
    onClick={onClick}
    className="pc-row flex w-full items-center gap-3 px-3 py-2.5 text-left"
    data-testid={testId}
  >
    {media && (
      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
        {media}
      </div>
    )}
    <div className="min-w-0 flex-1 leading-tight">
      <div
        className="truncate text-base font-semibold text-slate-900"
        data-testid={labelTestId}
      >
        {label}
      </div>
      {hint && <div className="mt-0.5 text-xs text-slate-500">{hint}</div>}
    </div>
    <span
      className="flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600"
      data-testid={changeTestId}
    >
      <ArrowLeftRight size={14} />
      {changeLabel}
    </span>
  </button>
);

export default SelectedValueRow;
