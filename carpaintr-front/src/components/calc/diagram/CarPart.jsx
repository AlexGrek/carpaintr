import { memo } from "react";

// --- CarPart Component ---
const CarPart = memo(({ id, name, className, onPartClick, partSubComponents, selectedCount = 0 }) => {
  const items = partSubComponents[name] || [];
  const isDisabled = items.length === 0;
  const combinedClassName = `car-part ${className}${isDisabled ? " car-part-disabled" : ""}${selectedCount > 0 ? " car-part-selected" : ""}`;

  return (
    <div
      className={combinedClassName}
      onClick={isDisabled ? undefined : (e) => onPartClick(e, name, items)}
      data-testid={`calc-car-part-${id}`}
      aria-disabled={isDisabled}
      title={isDisabled ? "Недоступно для обраного типу кузова" : undefined}
    >
      <span>{name}</span>
      {selectedCount > 0 && (
        <span className="car-part-badge">{selectedCount}</span>
      )}
    </div>
  );
});

CarPart.displayName = "CarPart";

export default CarPart;
