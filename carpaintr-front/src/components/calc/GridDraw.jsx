import React, { useState, useEffect, useRef, useCallback } from "react";
import { RadioGroup, Radio, Button, ButtonGroup, Divider, Whisper, Tooltip } from 'rsuite';
import "./GridDraw.css";

const ColorBlock = ({ color }) => {
  return <div style={{ border: '1px solid grey', backgroundColor: color, width: '6pt', height: '6pt', marginRight: '3pt', display: 'inline-block' }} />
}

const GridDraw = ({
  gridData: initialGridData, // Rename to initialGridData
  onGridChange,
  visual,
}) => {
  const [currentMode, setCurrentMode] = useState(0); // Mode: 0=Clear, 1=Light, 2=Medium, 3=Severe
  const [isDrawing, setIsDrawing] = useState(false);
  const [isLargeScreen, setIsLargeScreen] = useState(window.innerWidth >= 400);
  const [internalGridData, setInternalGridData] = useState(initialGridData); // Internal state for grid data
  const [isDebouncing, setIsDebouncing] = useState(false); // State to indicate debouncing
  const debounceTimeoutRef = useRef(null);

  // Update internal grid data when initialGridData prop changes (e.g., parent resets the grid)
  useEffect(() => {
    setInternalGridData(initialGridData);
  }, [initialGridData]);

  useEffect(() => {
    const handleResize = () => {
      setIsLargeScreen(window.innerWidth >= 800);
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Debounced update to the outer state
  const debouncedOnGridChange = useCallback((newGrid) => {
    setIsDebouncing(true);
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    debounceTimeoutRef.current = setTimeout(() => {
      let marked = [];
      newGrid.forEach((slice, y) =>
        slice.forEach((value, x) =>
          value > 1 && marked.push(`"${x},${y}"`)));
      let data = marked.join(",");
      console.log(`Updating outer state with new grid data: ${data}`);
      onGridChange(newGrid);
      setIsDebouncing(false);
    }, 1000); // 1 second debounce
  }, [onGridChange]);

  const updateCellState = useCallback((x, y) => {
    setInternalGridData(prevGridData => {
      const newGridData = [...prevGridData];
      if (newGridData[y][x] >= 0) {
        newGridData[y][x] = currentMode;
        debouncedOnGridChange(newGridData); // Trigger debounced update
      }
      return newGridData;
    });
  }, [currentMode, debouncedOnGridChange]);

  const handleMouseDown = useCallback((x, y) => {
    setIsDrawing(true);
    updateCellState(x, y);
  }, [updateCellState]);

  const handleMouseUp = useCallback(() => {
    setIsDrawing(false);
  }, []);

  const handleMouseMove = useCallback((x, y) => {
    if (isDrawing) {
      updateCellState(x, y);
    }
  }, [isDrawing, updateCellState]);

  const fillAll = useCallback(() => {
    setInternalGridData(prevGridData => {
      const newGridData = prevGridData.map((row) =>
        row.map((cell) => (cell >= 0 ? currentMode : cell))
      );
      debouncedOnGridChange(newGridData);
      return newGridData;
    });
  }, [currentMode, debouncedOnGridChange]);

  const clearAll = useCallback(() => {
    setInternalGridData(prevGridData => {
      const newGridData = prevGridData.map((row) =>
        row.map((cell) => (cell >= 0 ? 0 : cell))
      );
      debouncedOnGridChange(newGridData);
      return newGridData;
    });
  }, [debouncedOnGridChange]);

  // Determine the class for mirroring the background
  const gridClasses = `grid ${visual.mirrored ? 'mirrored' : ''}`;

  // Set CSS variables for background image and grid dimensions
  const gridStyle = {
    '--grid-background-image': `url(/${visual.image})`,
    // Use 1fr for flexible sizing, CSS will handle the aspect ratio
    gridTemplateColumns: `repeat(${internalGridData[0].length}, 1fr)`,
    gridTemplateRows: `repeat(${internalGridData.length}, 1fr)`,
    outline: isDebouncing ? "3px solid orange" : "3px solid transparent",
    transition: "outline 0.3s ease-in-out",
    maxWidth: "500px",
  };

  return (
    <div
      className="grid-container"
    >
      <Divider />
      <p>Оберіть тип пошкодження та вкажіть зону пошкодження на схемі.
        <Whisper
          trigger="click"
          placement="bottom"
          controlId={`control-id-topStart`}
          speaker={
            <Tooltip>Оберіть тип пошкодження на наступній панелі та відмітьте пошкоджені місця відповідним кольором на схемі, приблизно зафарбувавши зону пошкодження за допомогою квадратиків нижче. Використовуйте інструмент "очистка" для того, щоб очистити квадратики. Ви можете використовувати різні типи пошкоджень на одній схемі, обираючи різні інструменти. Кожному типу пошкоджень відповідає певний колір.</Tooltip>
          }
        >
          <Button appearance="link" style={{ display: "inline" }}>Як?</Button>
        </Whisper>
      </p>
      <div className="grid-controls">
        <RadioGroup
          name="mode"
          inline={isLargeScreen}
          appearance={!isLargeScreen ? "default" : "picker"}
          value={currentMode}
          onChange={setCurrentMode}
        >
          <Radio value={0}>Очистка</Radio>
          <Radio value={1}><ColorBlock color='yellow' /> Прогин</Radio>
          <Radio value={2}><ColorBlock color='orange' /> Складні пошкодження</Radio>
          <Radio value={3}><ColorBlock color='red' /> Розрив, складки</Radio>
        </RadioGroup>
      </div>

      <div
        className={gridClasses} // Apply dynamic classes
        style={gridStyle} // Apply CSS variables and grid template
        onMouseLeave={handleMouseUp} // Stop drawing if mouse leaves the grid
      >
        {internalGridData.map((row, y) =>
          row.map((cell, x) => (
            <div
              key={`${x}-${y}`}
              className="grid-cell"
              style={{
                backgroundColor: getCellColor(cell),
                // Removed fixed width and height, now handled by CSS aspect-ratio
              }}
              onMouseDown={() => handleMouseDown(x, y)}
              onMouseUp={handleMouseUp}
              onMouseMove={() => handleMouseMove(x, y)}
            ></div>
          ))
        )}
      </div>
      <div className="grid-controls"><ButtonGroup>
        <Button onClick={fillAll}>Заповнити все</Button>
        <Button onClick={clearAll}>Очистити</Button>
      </ButtonGroup></div>
      <Divider />
    </div>
  );
};

const getCellColor = (state) => {
  switch (state) {
    case -1:
      return "rgba(169, 169, 169, 0.5)"; // Disabled
    case 0:
      return "rgba(173, 216, 230, 0.5)"; // No state
    case 1:
      return "yellow"; // Light damage
    case 2:
      return "orange"; // Medium damage
    case 3:
      return "red"; // Severe damage
    default:
      return "transparent";
  }
};

export default GridDraw;