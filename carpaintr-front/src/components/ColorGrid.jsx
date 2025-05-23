import React from "react";
import "./ColorGrid.css";

const ColorGrid = ({ colors, selectedColor, onChange }) => {
  return (
    <div className="color-grid-container">
      {colors.map(({ hex, colorName, id }) => (
        <div
          key={id}
          className={`color-card ${selectedColor === id ? "selected-card" : ""}`}
          onClick={() => onChange(id)}
        >
          <div
            className="color-preview"
            style={{ backgroundColor: hex }}
          ></div>
          <div className="label">
            <span>{colorName}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ColorGrid;
