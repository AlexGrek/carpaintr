import React from "react";
import "./ColorGrid.css";
import Trans from '../localization/Trans';
import { useLocale } from '../localization/LocaleContext';

const ColorGrid = ({ colors, selectedColor, onChange }) => {
  const renderColor = (color) => {
    const { hex, name_eng, name_ukr } = color;
    return <div
          key={name_ukr}
          className={`color-card fade-in-simple ${selectedColor === name_ukr ? "selected-card" : ""}`}
          onClick={() => onChange(selectedColor === name_ukr ? null : name_ukr)}
        >
          <div
            className="color-preview"
            style={{ backgroundColor: hex }}
          >

          </div>
          <div className="label">
            <span>{name_ukr}</span>
          </div>
        </div>
  }

  const renderSelectedColor = () => {
    const color = colors.find((item) => item.name_ukr === selectedColor);
    if (color)
      return renderColor(color);
    else {
      // console.error(color);
      return <p>{JSON.stringify(color)}</p>
    }
  }

  return (
    <div className={selectedColor == null ? "color-grid-container" : "color-grid-container-selected"}>
      {selectedColor == null ? colors.map(renderColor) : renderSelectedColor()}
    </div>
  );
};

export default ColorGrid;
