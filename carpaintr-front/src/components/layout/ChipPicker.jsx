import "./PickerControls.css";

/**
 * Single-choice row of compact option chips (e.g. car class).
 * Items: strings or { value, label }.
 */
const ChipPicker = ({ items = [], value = null, onSelect, testId }) => (
  <div className="flex flex-wrap gap-2" data-testid={testId}>
    {items.map((item) => {
      const itemValue = typeof item === "string" ? item : item.value;
      const label = typeof item === "string" ? item : (item.label ?? item.value);
      const isSelected = value === itemValue;
      return (
        <button
          key={itemValue}
          type="button"
          onClick={() => onSelect?.(itemValue)}
          aria-pressed={isSelected}
          className={`pc-chip min-w-12 px-3 py-2 text-sm font-medium${
            isSelected ? " is-selected" : ""
          }`}
          data-testid={testId ? `${testId}-option-${String(itemValue)}` : undefined}
        >
          {label}
        </button>
      );
    })}
  </div>
);

export default ChipPicker;
