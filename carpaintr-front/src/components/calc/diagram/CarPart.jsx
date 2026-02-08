import { memo } from "react";

// --- CarPart Component ---
const CarPart = memo(({ id, name, className, onPartClick, partSubComponents }) => {
  const combinedClassName = `car-part ${className}`;
  const items = partSubComponents[name] || [];

  return (
    <div
      className={combinedClassName}
      onClick={(e) => onPartClick(e, name, items)}
    >
      <span>{name}</span>
    </div>
  );
});

CarPart.displayName = "CarPart";

export default CarPart;
