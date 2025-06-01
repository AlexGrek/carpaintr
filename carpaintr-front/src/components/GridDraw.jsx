import React, { useState, useEffect } from "react";
import { RadioGroup, Radio, Button, ButtonGroup, Divider, Whisper, Tooltip } from 'rsuite';
import "./GridDraw.css";

const ColorBlock = ({color}) => {
  return <div style={{border: '1px solid grey', backgroundColor: color, width: '6pt', height: '6pt', marginRight: '3pt', display: 'inline-block'}}/>
}

const GridDraw = ({
  gridData,
  onGridChange,
  visual,
  // cellSize is no longer directly used for pixel dimensions, but can be kept for other purposes if needed
}) => {
  const [currentMode, setCurrentMode] = useState(0); // Mode: 0=Clear, 1=Light, 2=Medium, 3=Severe
  const [isDrawing, setIsDrawing] = useState(false);
  const [isLargeScreen, setIsLargeScreen] = useState(window.innerWidth >= 400);

  useEffect(() => {
    const handleResize = () => {
      setIsLargeScreen(window.innerWidth >= 800);
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const handleMouseDown = (x, y) => {
    setIsDrawing(true);
    if (gridData[y][x] >= 0) {
      updateCellState(x, y);
    }
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  const handleMouseMove = (x, y) => {
    if (isDrawing && gridData[y][x] >= 0) {
      updateCellState(x, y);
    }
  };

  const updateCellState = (x, y) => {
    const newGridData = [...gridData];
    newGridData[y][x] = currentMode;
    onGridChange(newGridData);
  };

  const fillAll = () => {
    const newGridData = gridData.map((row) =>
      row.map((cell) => (cell >= 0 ? currentMode : cell))
    );
    onGridChange(newGridData);
  };

  const clearAll = () => {
    const newGridData = gridData.map((row) =>
      row.map((cell) => (cell >= 0 ? 0 : cell))
    );
    onGridChange(newGridData);
  };

  // Determine the class for mirroring the background
  const gridClasses = `grid ${visual.mirrored ? 'mirrored' : ''}`;

  // Set CSS variables for background image and grid dimensions
  const gridStyle = {
    '--grid-background-image': `url(${visual.image})`,
    // Use 1fr for flexible sizing, CSS will handle the aspect ratio
    gridTemplateColumns: `repeat(${gridData[0].length}, 1fr)`,
    gridTemplateRows: `repeat(${gridData.length}, 1fr)`,
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
          <Button appearance="link" style={{display: "inline"}}>Як?</Button>
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
          <Radio value={1}><ColorBlock color='yellow'/> Прогин</Radio>
          <Radio value={2}><ColorBlock color='orange'/> Складні пошкодження</Radio>
          <Radio value={3}><ColorBlock color='red'/> Розрив, складки</Radio>
        </RadioGroup>
      </div>

      <div
        className={gridClasses} // Apply dynamic classes
        style={gridStyle} // Apply CSS variables and grid template
        onMouseLeave={handleMouseUp} // Stop drawing if mouse leaves the grid
      >
        {gridData.map((row, y) =>
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
