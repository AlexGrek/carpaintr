/* eslint-disable react/display-name */
import React, { useEffect, useState } from "react";
import { authFetchYaml } from "../../utils/authFetch";
import ColorGrid from "../ColorGrid";

// Placeholder component that mimics the color grid structure
const ColorGridPlaceholder = () => {
  const rows = 5;
  const cols = 4;
  const totalItems = rows * cols;

  return (
    <div
      style={{
        display: "grid",
        maxWidth: "600px",
        margin: "auto",
        gap: "16px",
        gridTemplateColumns: "repeat(4, minmax(24px, 1fr))",
        padding: "7px",
      }}
    >
      {Array.from({ length: totalItems }).map((_, index) => (
        <div
          key={index}
          style={{
            borderRadius: "8px",
            overflow: "hidden",
            boxShadow: "2px 2px 5px rgba(0, 0, 0, 0.2)",
            opacity: 0.3,
          }}
        >
          <div
            style={{
              height: "60px",
              backgroundColor: "rgba(255, 255, 255, 0.8)",
            }}
          />
          <div
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.7)",
              padding: "8px",
              textAlign: "center",
              fontSize: "14px",
              height: "20px",
            }}
          />
        </div>
      ))}
    </div>
  );
};

// Memoized ColorPicker to prevent unnecessary re-renders
const ColorPicker = React.memo(({ setColor, selectedColor }) => {
  const [baseColors, setBaseColors] = useState({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        let data = await authFetchYaml("/api/v1/user/global/colors.json");
        setBaseColors(data);
      } catch (error) {
        console.error("Failed to fetch colors:", error);
      }
    };
    fetchData();
  }, []); // Empty dependency array means this runs once on mount

  if (baseColors == null || baseColors.rows === undefined) {
    return <ColorGridPlaceholder />; // Show a placeholder while loading
  }

  const displayColors = baseColors.rows;

  return (
    <div>
      {displayColors.map((subgrid, index) => (
        <ColorGrid
          key={index}
          colors={subgrid}
          selectedColor={selectedColor}
          onChange={setColor}
        />
      ))}
    </div>
  );
});

export default ColorPicker;
