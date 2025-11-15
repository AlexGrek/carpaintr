// --- CarPart Component ---
const CarPart = ({ id, name, className, onPartClick, partSubComponents }) => {
  const combinedClassName = `car-part ${className}`;

  return (
    <div
      className={combinedClassName}
      onClick={(e) => onPartClick(e, name, partSubComponents[name] || [])}
    >
      <span>{name}</span>
    </div>
  );
};

export default CarPart;
