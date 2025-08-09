import { useCallback, useEffect, useState } from "react";
import ContextMenu from "./ContextMenu";
import CarPart from "./CarPart";
import './CarDiagram.css';

export const partSubComponents = {
    'Капот': ['Замок капота', 'Амортизатор капота', 'Петля капота', 'Ущільнювач'],
    'Лобове скло': ['Датчик дощу', 'Кріплення дзеркала', 'Молдинг'],
    'Дах': ['Люк', 'Рейлінги', 'Антена', 'Панорамна стеля'],
    'Заднє скло': ['Обігрів скла', 'Молдинг', 'Двірник'],
    'Кришка багажника': ['Замок', 'Спойлер', 'Емблема', 'Внутрішня обшивка'],
    'Передній бампер': ['Решітка радіатора', 'Протитуманна фара', 'Парктронік', 'Омивач фар'],
    'Задній бампер': ['Парктронік', 'Катафот', 'Накладка'],
    'Передня ліва фара': ['Лампа ближнього світла', 'Лампа дальнього світла', 'Денні ходові вогні', 'Коректор фари'],
    'Передня права фара': ['Лампа ближнього світла', 'Лампа дальнього світла', 'Денні ходові вогні', 'Коректор фари'],
    'Задній лівий ліхтар': ['Стоп-сигнал', 'Габаритний вогонь', 'Покажчик повороту'],
    'Задній правий ліхтар': ['Стоп-сигнал', 'Габаритний вогонь', 'Покажчик повороту'],
    'Передні ліві двері': ['Склопідіймач', 'Ручка дверей', 'Дзеркало', 'Динамік'],
    'Передні праві двері': ['Склопідіймач', 'Ручка дверей', 'Дзеркало', 'Динамік'],
    'Задні ліві двері': ['Склопідіймач', 'Ручка дверей', 'Динамік'],
    'Задні праві двері': ['Склопідіймач', 'Ручка дверей', 'Динамік'],
    'Переднє ліве крило': ['Підкрилок', 'Кріплення крила', 'Повторювач повороту'],
    'Переднє праве крило': ['Підкрилок', 'Кріплення крила', 'Повторювач повороту'],
    'Заднє ліве крило': ['Підкрилок', 'Кріплення крила', 'Лючок бензобака'],
    'Заднє праве крило': ['Підкрилок', 'Кріплення крила'],
    'Ліва боковина': ['Молдинг', 'Структурний елемент'],
    'Права боковина': ['Молдинг', 'Структурний елемент'],
    'Колесо': ['Диск', 'Шина', 'Ковпак', 'Датчик тиску'],
};

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
const CarDiagram = () => {
    const [menuState, setMenuState] = useState({
        visible: false,
        position: { x: 0, y: 0 },
        items: [],
        title: ''
    });

    const handlePartClick = (event, title, items) => {
        event.stopPropagation();
        setMenuState({
            visible: true,
            position: { x: event.clientX, y: event.clientY },
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

    // Define all car parts to be rendered
    const carParts = [
        // Central
        { id: 'hood', name: 'Капот' },
        { id: 'frontBumper', name: 'Передній бампер' },
        { id: 'windshield', name: 'Лобове скло' },
        { id: 'roof', name: 'Дах' },
        { id: 'rearGlass', name: 'Заднє скло' },
        { id: 'trunk', name: 'Кришка багажника' },
        { id: 'rearBumper', name: 'Задній бампер' },
        { id: 'headlightLeft', name: 'Передня ліва фара' },
        { id: 'headlightRight', name: 'Передня права фара' },
        { id: 'taillightLeft', name: 'Задній лівий ліхтар' },
        { id: 'taillightRight', name: 'Задній правий ліхтар' },
        // Sides
        { id: 'frontFenderLeft', name: 'Переднє ліве крило' },
        { id: 'frontFenderRight', name: 'Переднє праве крило' },
        { id: 'rearFenderLeft', name: 'Заднє ліве крило' },
        { id: 'rearFenderRight', name: 'Заднє праве крило' },
        { id: 'frontDoorLeft', name: 'Передні ліві двері' },
        { id: 'frontDoorRight', name: 'Передні праві двері' },
        { id: 'rearDoorLeft', name: 'Задні ліві двері' },
        { id: 'rearDoorRight', name: 'Задні праві двері' },
        { id: 'sidePanelLeft', name: 'Ліва боковина' },
        { id: 'sidePanelRight', name: 'Права боковина' },
        // Wheels
        { id: 'wheelFrontLeft', name: 'Колесо' },
        { id: 'wheelFrontRight', name: 'Колесо' },
        { id: 'wheelRearLeft', name: 'Колесо' },
        { id: 'wheelRearRight', name: 'Колесо' },
    ];

    return (
            <div className="car-container" onClick={closeMenu}>
                {carParts.map(part => (
                    <CarPart
                        key={part.id}
                        id={part.id}
                        name={part.name}
                        className={partClassNames[part.id]}
                        onPartClick={handlePartClick}
                    />
                ))}
                {menuState.visible && (
                    <ContextMenu
                        position={menuState.position}
                        items={menuState.items}
                        title={menuState.title}
                    />
                )}
            </div>
    );
};

export default CarDiagram;