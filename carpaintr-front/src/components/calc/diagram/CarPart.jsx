import { memo } from "react";

// --- CarPart Component ---
const CarPart = memo(({ id, name, className, onPartClick, partSubComponents, selectedCount = 0 }) => {
  const items = partSubComponents[name] || [];
  const isDisabled = items.length === 0;
  const combinedClassName = `car-part ${className}${isDisabled ? " car-part-disabled" : ""}`;

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
        <span
          className="car-part-badge"
          style={{
            position: 'absolute',
            top: '2px',
            right: '2px',
            backgroundColor: '#16a34a',
            color: 'white',
            borderRadius: '50%',
            width: '20px',
            height: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '11px',
            fontWeight: 'bold',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            zIndex: 10
          }}
        >
          {selectedCount}
        </span>
      )}
    </div>
  );
});

CarPart.displayName = "CarPart";

export default CarPart;
