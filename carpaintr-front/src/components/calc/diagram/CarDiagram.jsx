import { useCallback, useEffect, useRef, useState } from "react";
import ContextMenu from "./ContextMenu";
import CarPart from "./CarPart";
import './CarDiagram.css';

export function buildCarSubcomponentsFromT2(data) {
    return data.reduce((acc, item) => {
        const zone = item.zone?.trim();
        const name = item.name?.trim();

        if (!zone || !name || name === "(Додати)") return acc; // skip invalid or placeholder names

        if (!acc[zone]) {
            acc[zone] = [];
        }

        acc[zone].push(item);
        return acc;
    }, {});
}

// Define all car parts to be rendered
const carParts = [
    // Central
    { id: 'hood', name: 'Капот' },
    { id: 'frontBumper', name: 'Бампер передній' },
    { id: 'windshield', name: 'Скло лобове' },
    { id: 'roof', name: 'Дах' },
    { id: 'rearGlass', name: 'Скло заднє' },
    { id: 'trunk', name: 'Кришка багажника' },
    { id: 'rearBumper', name: 'Бампер задній' },
    { id: 'headlightLeft', name: 'Фара передня ліва' },
    { id: 'headlightRight', name: 'Фара передня права' },
    { id: 'taillightLeft', name: 'Ліхтар задній лівий' },
    { id: 'taillightRight', name: 'Ліхтар задній правий' },
    // Sides
    { id: 'frontFenderLeft', name: 'Крило переднє ліве' },
    { id: 'frontFenderRight', name: 'Крило переднє праве' },
    { id: 'rearFenderLeft', name: 'Крило заднє ліве' },
    { id: 'rearFenderRight', name: 'Крило заднє праве' },
    { id: 'frontDoorLeft', name: 'Двері передні ліві' },
    { id: 'frontDoorRight', name: 'Двері передні праві' },
    { id: 'rearDoorLeft', name: 'Двері задні ліві' },
    { id: 'rearDoorRight', name: 'Двері задні праві' },
    { id: 'sidePanelLeft', name: 'Боковина ліва' },
    { id: 'sidePanelRight', name: 'Боковина права' },
    // Wheels
    { id: 'wheelFrontLeft', name: 'Колесо переднє ліве' },
    { id: 'wheelFrontRight', name: 'Колесо переднє праве' },
    { id: 'wheelRearLeft', name: 'Колесо заднє ліве' },
    { id: 'wheelRearRight', name: 'Колесо заднє праве' },
];

// Mapping from part IDs to CSS classes
export const partClassNames = {
    hood: 'hood',
    frontBumper: 'front-bumper',
    windshield: 'windshield',
    roof: 'roof',
    rearGlass: 'rear-glass',
    trunk: 'trunk',
    rearBumper: 'rear-bumper',
    headlightLeft: 'headlight-left',
    headlightRight: 'headlight-right',
    taillightLeft: 'taillight-left',
    taillightRight: 'taillight-right',
    frontFenderLeft: 'front-fender-left',
    frontFenderRight: 'front-fender-right',
    rearFenderLeft: 'rear-fender-left',
    rearFenderRight: 'rear-fender-right',
    frontDoorLeft: 'front-door-left',
    frontDoorRight: 'front-door-right',
    rearDoorLeft: 'rear-door-left',
    rearDoorRight: 'rear-door-right',
    sidePanelLeft: 'side-panel-left',
    sidePanelRight: 'side-panel-right',
    wheelFrontLeft: 'wheel-front-left',
    wheelFrontRight: 'wheel-front-right',
    wheelRearLeft: 'wheel-rear-left',
    wheelRearRight: 'wheel-rear-right',
};

// --- Main CarDiagram Component ---
const CarDiagram = ({ partSubComponents = PARTSUBCOMPONENTS }) => {
    const [menuState, setMenuState] = useState({
        visible: false,
        position: { x: 0, y: 0 },
        items: [],
        title: ''
    });

    const menuRef = useRef(null);

    const handlePartClick = (event, title, items) => {
        event.stopPropagation();
        setMenuState({
            visible: true,
            position: {
                x: event.clientX - 15,   // center X of clicked element
                y: event.clientY - 60   // center Y of clicked element
            },
            items: items,
            title: title
        });
    };

    const closeMenu = useCallback(() => {
        setMenuState(prevState => ({ ...prevState, visible: false }));
    }, []);

    useEffect(() => {
        window.addEventListener('click', closeMenu);
        return () => {
            window.removeEventListener('click', closeMenu);
        };
    }, [closeMenu]);

    // Adjust position after menu is rendered
    useEffect(() => {
        if (menuState.visible && menuRef.current) {
            const { offsetWidth: w, offsetHeight: h } = menuRef.current;
            const vw = window.innerWidth;
            const vh = window.innerHeight;

            let { x, y } = menuState.position;

            if (x + w > vw) x = x - w;     // flip to left
            if (y + h > vh) y = y - h;     // flip above

            if (x !== menuState.position.x || y !== menuState.position.y) {
                setMenuState(s => ({ ...s, position: { x, y } }));
            }
        }
    }, [menuState.position, menuState.visible]);

    return (
        <>
            <div className="car-container" onClick={closeMenu}>
                {carParts.map(part => (
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
                />
            )}
        </>
    );
};

export default CarDiagram;