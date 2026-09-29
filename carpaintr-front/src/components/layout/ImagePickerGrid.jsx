import { Check } from "lucide-react";
import SelectedValueRow from "./SelectedValueRow";
import "./PickerControls.css";

const ImagePickerGrid = ({
  items = [],
  onSelect,
  value = null,
  testId,
  collapseOnSelect = false,
  changeLabel = "Change",
}) => {
  // When collapsed, only the selected item is shown as a row with a "change"
  // affordance; clicking it clears the selection
  const selectedItem = collapseOnSelect
    ? items.find((i) => i.value === value)
    : undefined;

  if (value !== null && selectedItem) {
    return (
      <SelectedValueRow
        media={
          <img
            src={selectedItem.image}
            alt={selectedItem.label}
            className="h-10 w-10 object-contain"
          />
        }
        label={selectedItem.label}
        changeLabel={changeLabel}
        onClick={() => onSelect(null)}
        testId={testId}
        labelTestId={testId ? `${testId}-option-${selectedItem.value}` : undefined}
        changeTestId={testId ? `${testId}-change` : undefined}
      />
    );
  }

  return (
    <div
      className="grid gap-2.5"
      style={{ gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))" }}
      data-testid={testId}
    >
      {items.map((item) => {
        const isSelected = value === item.value;
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onSelect(item.value)}
            aria-pressed={isSelected}
            data-testid={testId ? `${testId}-option-${item.value}` : undefined}
            className={`pc-tile relative flex flex-col items-center p-2${
              isSelected ? " is-selected" : ""
            }`}
          >
            {isSelected && (
              <span className="absolute -right-1.5 -top-1.5 rounded-full bg-blue-500 p-0.5 text-white">
                <Check size={12} strokeWidth={3} />
              </span>
            )}
            {/* multiply blend makes the images' white background disappear on tinted tiles */}
            <img
              src={item.image}
              alt={item.label}
              className="mb-1.5 h-16 w-full object-contain mix-blend-multiply"
            />
            <span
              className={`text-center text-xs leading-snug break-words ${
                isSelected ? "font-semibold" : ""
              }`}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default ImagePickerGrid;
