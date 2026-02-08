import { useCallback, useEffect, useRef, useState } from "react";
import ContextMenu from "./ContextMenu";
import CarPart from "./CarPart";
import "./CarDiagram.css";

// Menu positioning offsets
const MENU_OFFSET_X = -15;
const MENU_OFFSET_Y = -60;

export function buildCarSubcomponentsFromT2(data) {
  return data.reduce((acc, item) => {
    const zone = item.zone?.trim();
    const name = item.name?.trim();

    // Skip invalid or placeholder names
    if (!zone || !name || name === "(Додати)") {
      // console.log(`skipping ${JSON.stringify(item)}`)
      return acc;
    }

    if (!acc[zone]) {
      acc[zone] = [];
    }

    acc[zone].push({ ...item, alreadyUsed: false });
    return acc;
  }, {});
}

// Define all car parts to be rendered
const carParts = [
  // Central
  { id: "hood", name: "Капот" },
  { id: "frontBumper", name: "Бампер передній" },
  { id: "windshield", name: "Скло лобове" },
  { id: "roof", name: "Дах" },
  { id: "rearGlass", name: "Скло заднє" },
  { id: "trunk", name: "Кришка багажника" },
  { id: "rearBumper", name: "Бампер задній" },
  { id: "headlightLeft", name: "Фара передня ліва" },
  { id: "headlightRight", name: "Фара передня права" },
  { id: "taillightLeft", name: "Ліхтар задній лівий" },
  { id: "taillightRight", name: "Ліхтар задній правий" },
  // Sides
  { id: "frontFenderLeft", name: "Крило переднє ліве" },
  { id: "frontFenderRight", name: "Крило переднє праве" },
  { id: "rearFenderLeft", name: "Крило заднє ліве" },
  { id: "rearFenderRight", name: "Крило заднє праве" },
  { id: "frontDoorLeft", name: "Двері передні ліві" },
  { id: "frontDoorRight", name: "Двері передні праві" },
  { id: "rearDoorLeft", name: "Двері задні ліві" },
  { id: "rearDoorRight", name: "Двері задні праві" },
  { id: "sidePanelLeft", name: "Боковина ліва" },
  { id: "sidePanelRight", name: "Боковина права" },
  // Wheels
  { id: "wheelFrontLeft", name: "Колесо переднє ліве" },
  { id: "wheelFrontRight", name: "Колесо переднє праве" },
  { id: "wheelRearLeft", name: "Колесо заднє ліве" },
  { id: "wheelRearRight", name: "Колесо заднє праве" },
];

// Mapping from part IDs to CSS classes
export const partClassNames = {
  hood: "hood",
  frontBumper: "front-bumper",
  windshield: "windshield",
  roof: "roof",
  rearGlass: "rear-glass",
  trunk: "trunk",
  rearBumper: "rear-bumper",
  headlightLeft: "headlight-left",
  headlightRight: "headlight-right",
  taillightLeft: "taillight-left",
  taillightRight: "taillight-right",
  frontFenderLeft: "front-fender-left",
  frontFenderRight: "front-fender-right",
  rearFenderLeft: "rear-fender-left",
  rearFenderRight: "rear-fender-right",
  frontDoorLeft: "front-door-left",
  frontDoorRight: "front-door-right",
  rearDoorLeft: "rear-door-left",
  rearDoorRight: "rear-door-right",
  sidePanelLeft: "side-panel-left",
  sidePanelRight: "side-panel-right",
  wheelFrontLeft: "wheel-front-left",
  wheelFrontRight: "wheel-front-right",
  wheelRearLeft: "wheel-rear-left",
  wheelRearRight: "wheel-rear-right",
};

// --- Main CarDiagram Component ---
const CarDiagram = ({ alreadyPresent = [], partSubComponents = PARTSUBCOMPONENTS, onSelect = () => {} }) => {
  const [menuState, setMenuState] = useState({
    visible: false,
    position: { x: 0, y: 0 },
    items: [],
    title: "",
  });

  const menuRef = useRef(null);

  const handlePartClick = (event, title, items) => {
    event.stopPropagation();

    // Create Set for O(1) lookups instead of O(n) indexOf
    const alreadyPresentSet = new Set(alreadyPresent);

    setMenuState({
      visible: true,
      position: {
        x: event.clientX + MENU_OFFSET_X,
        y: event.clientY + MENU_OFFSET_Y,
      },
      items: items.map((item) => {
        if (alreadyPresentSet.has(item.name)) {
          console.log(item)
          console.log("HOLA!")
          return { ...item, alreadyUsed: true }
        }

        return item
      }),
      title: title,
    });
  };

  const closeMenu = useCallback(() => {
    setMenuState((prevState) => ({ ...prevState, visible: false }));
  }, []);

  useEffect(() => {
    if (!menuState.visible) return;

    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        closeMenu();
      }
    };

    // Delay to avoid immediate close from the same click that opened menu
    const timeoutId = setTimeout(() => {
      document.addEventListener("click", handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("click", handleClickOutside);
    };
  }, [menuState.visible, closeMenu]);

  // Adjust position after menu is rendered to keep it within viewport
  useEffect(() => {
    if (menuState.visible && menuRef.current) {
      const { offsetWidth: w, offsetHeight: h } = menuRef.current;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      let { x, y } = menuState.position;
      let adjusted = false;

      if (x + w > vw) {
        x = x - w; // flip to left
        adjusted = true;
      }
      if (y + h > vh) {
        y = y - h; // flip above
        adjusted = true;
      }

      if (adjusted) {
        setMenuState((s) => ({ ...s, position: { x, y } }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuState.visible]); // Intentionally omitting menuState.position to prevent re-render loops

  return (
    <>
      <div className="car-container" onClick={closeMenu}>
        {carParts.map((part) => (
          <CarPart
            key={part.id}
            id={part.id}
            name={part.name}
            className={partClassNames[part.id]}
            onPartClick={handlePartClick}
            partSubComponents={partSubComponents}
          />
        ))}
      </div>
      {menuState.visible && (
        <ContextMenu
          ref={menuRef}
          position={menuState.position}
          items={menuState.items}
          title={menuState.title}
          onSelect={onSelect}
        />
      )}
    </>
  );
};

export default CarDiagram;
