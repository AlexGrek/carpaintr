import { Car, Palette, Tag, Scan, CreditCard, Gauge } from "lucide-react";

const CarVisualizer = ({ data }) => {
  const { paint, car } = data;

  const cardStyle = {
    fontFamily: "Arial, sans-serif",
    border: "1px solid #ddd",
    borderRadius: "8px",
    boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)",
    padding: "16px",
    maxWidth: "300px",
    margin: "20px auto",
    backgroundColor: "#fff",
    color: "#333",
  };

  const headerStyle = {
    display: "flex",
    alignItems: "center",
    marginBottom: "16px",
    borderBottom: "1px solid #eee",
    paddingBottom: "8px",
  };

  const titleStyle = {
    marginLeft: "8px",
    fontSize: "1.2em",
    fontWeight: "bold",
  };

  const itemStyle = {
    display: "flex",
    alignItems: "center",
    marginBottom: "8px",
  };

  const iconStyle = {
    marginRight: "8px",
    color: "#555",
  };

  const labelStyle = {
    fontWeight: "bold",
    marginRight: "4px",
  };

  const valueStyle = {
    color: "#666",
  };

  const renderItem = (IconComponent, label, value) => {
    if (!value) {
      return null;
    }
    return (
      <div style={itemStyle}>
        <IconComponent size={20} style={iconStyle} />
        <span style={labelStyle}>{label}:</span>
        <span style={valueStyle}>{value}</span>
      </div>
    );
  };

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <Car size={24} style={{ color: "#007bff" }} />
        <h2 style={titleStyle}>Car Details</h2>
      </div>
      {renderItem(Palette, "Color", paint?.color)}
      {renderItem(
        Tag,
        "Make/Model",
        car?.make || car?.model
          ? `${car.make || "N/A"}/${car.model || "N/A"}`
          : null,
      )}
      {renderItem(CreditCard, "License Plate", car?.licensePlate)}
      {renderItem(Scan, "VIN", car?.VIN)}
      {renderItem(Gauge, "Class", car?.carClass)}
      {renderItem(Car, "Body Type", car?.bodyType)}
    </div>
  );
};

export default CarVisualizer;
