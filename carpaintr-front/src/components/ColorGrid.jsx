import React from "react";
import "./ColorGrid.css";

const ColorGrid = ({ colors, selectedColor, onChange }) => {
  return (
    <div className="color-grid-container">
      {colors.map(({ hex, name_eng, name_ukr }) => (
        <div
          key={name_ukr}
          className={`color-card ${selectedColor === name_ukr ? "selected-card" : ""}`}
          onClick={() => onChange(name_ukr)}
        >
          <div
            className="color-preview"
            style={{ backgroundColor: hex }}
          ></div>
          <div className="label">
            <span>{name_ukr}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ColorGrid;
