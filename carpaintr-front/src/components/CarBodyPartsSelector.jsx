import React, { useEffect, useState, useCallback } from "react";
import { Button, Drawer, Steps, Slider, Divider, Panel, PanelGroup, RadioTileGroup, RadioTile, Carousel } from "rsuite";
import { Icon } from '@rsuite/icons';
import PinIcon from '@rsuite/icons/Pin';
import ConversionIcon from '@rsuite/icons/Conversion';
import OneColumnIcon from '@rsuite/icons/OneColumn';
import ColumnsIcon from '@rsuite/icons/Columns';
import SelectionInput from './SelectionInput'
import GridDraw from "./GridDraw";
import { authFetch } from '../utils/authFetch'; // Assuming authFetch is used, not authFetchYaml
import './CarBodyPartsSelector.css'

const CarBodyPartsSelector = ({ onChange, selectedParts, body, carClass }) => {
    // State for available parts fetched from the API
    const [availableParts, setAvailableParts] = useState([]);
    // State for parts not yet selected by the user, derived from availableParts
    const [unselectedParts, setUnselectedParts] = useState([]);

    // Local state for the part being currently configured in the drawer
    const [drawerCurrentPart, setDrawerCurrentPart] = useState(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [drawerTab, setDrawerTab] = useState(0);

    // Translations for car parts
    const carPartsTranslations = {
        "Hood": "Капот",
        "Front Bumper": "Передній бампер",
        "Rear Bumper": "Задній бампер",
        "Left Front Door": "Ліві передні двері",
        "Right Front Door": "Праві передні двері",
        "Left Rear Door": "Ліві задні двері",
        "Right Rear Door": "Праві задні двері",
        "Trunk": "Багажник",
        "Left Front Fender": "Ліве переднє крило",
        "Right Front Fender": "Праве переднє крило"
    };

    // Actions and their translations/icons
    const actions = {
        "polish": "Полірування",
        "replace_and_paint_used": "Заміна з фарбуванням (Б/У деталь)",
        "replace_and_paint_3rdparty": "Заміна з фарбуванням (неоригінальна деталь)",
        "replace_and_paint_original": "Заміна з фарбуванням (оригінальна деталь)",
        "paint_one_side": "Ремонт з фарбуванням зовнішньої сторони",
        "paint_two_sides": "Ремонт з фарбуванням обох сторін"
    };

    const actionsIcons = {
        "polish": <PinIcon />,
        "replace_and_paint_used": <ConversionIcon />,
        "replace_and_paint_3rdparty": <ConversionIcon />,
        "replace_and_paint_original": <ConversionIcon />,
        "paint_one_side": <OneColumnIcon />,
        "paint_two_sides": <ColumnsIcon />
    };

    const outsideRepairZoneOptions = {
        "no": "без пошкоджень",
        "slightly": "незначні пошкодження",
        "remove": "треба видалити"
    };

    // Effect to update unselectedParts when availableParts changes
    useEffect(() => {
        if (Array.isArray(availableParts)) {
            // Filter out parts that are already in selectedParts
            const currentlySelectedNames = new Set(selectedParts.map(p => p.name));
            const newUnselected = availableParts
                .map(part => part["Список деталь рус"])
                .filter(partName => !currentlySelectedNames.has(partName));
            setUnselectedParts(newUnselected);
        }
    }, [availableParts, selectedParts]); // Add selectedParts as a dependency

    // Effect to fetch available car parts from the API
    useEffect(() => {
        if (carClass == null || body == null) {
            return;
        }

        // Reset availableParts and unselectedParts when carClass or body changes
        setAvailableParts([]);
        setUnselectedParts([]);

        authFetch(`/api/v1/user/carparts/${carClass}/${body}`)
            .then(response => {
                // No navigation logic here, this component should not dictate routing.
                // If 403 occurs, authFetch should handle it (e.g., redirect to login).
                if (!response.ok) {
                    console.error(`HTTP error ${response.status}`);
                    // Optionally, handle specific errors or show user feedback
                    return Promise.reject(`Failed to fetch car parts: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (data) setAvailableParts(data);
            })
            .catch((err) => {
                console.error("Error fetching car parts:", err);
                alert(`Error fetching car parts: ${err.message || err}`);
            });
    }, [body, carClass]); // Dependencies for API fetch

    // Helper to generate initial grid data
    const generateInitialGrid = useCallback((rows, cols) => {
        const grid = [];
        for (let y = 0; y < rows; y++) {
            const row = [];
            for (let x = 0; x < cols; x++) {
                row.push(Math.random() < 0.1 ? -1 : 0); // 10% chance to be disabled (-1), otherwise 0
            }
            grid.push(row);
        }
        return grid;
    }, []);

    // Handler for selecting a new part from the dropdown
    const handlePartSelect = useCallback((partName) => {
        // Check if the part is already in selectedParts (e.g., if re-opening for edit)
        const existingPart = selectedParts.find(p => p.name === partName);

        const newPart = existingPart ?
            { ...existingPart } : // If existing, create a shallow copy to modify
            {
                action: null,
                replace: false,
                original: true,
                damageLevel: 0,
                name: partName,
                grid: generateInitialGrid(10, 15),
                outsideRepairZone: null
            };

        setDrawerCurrentPart(newPart);
        setIsDrawerOpen(true);
        setDrawerTab(0); // Always start from the first tab
    }, [selectedParts, generateInitialGrid]);

    // Handler for updating the local drawerCurrentPart state
    const updateDrawerCurrentPart = useCallback((updates) => {
        setDrawerCurrentPart(prevPart => {
            const updatedPart = { ...prevPart, ...updates };
            // Auto-advance tab if action is selected for the first time
            if (prevPart.action !== updatedPart.action && updatedPart.action !== null) {
                setDrawerTab(1);
            }
            return updatedPart;
        });
    }, []);

    // Handler for adding/updating a part to the global selectedParts
    const handleAddOrUpdatePart = useCallback(() => {
        if (!drawerCurrentPart) return;

        const updatedSelectedParts = selectedParts.map(part =>
            part.name === drawerCurrentPart.name ? drawerCurrentPart : part
        );

        // If the part was not found (it's a new addition), add it
        const isNewPart = !selectedParts.some(part => part.name === drawerCurrentPart.name);
        if (isNewPart) {
            updatedSelectedParts.push(drawerCurrentPart);
        }

        onChange(updatedSelectedParts);
        setIsDrawerOpen(false);
        setDrawerCurrentPart(null); // Clear local state after committing
    }, [selectedParts, drawerCurrentPart, onChange]);

    // Handler for unselecting a part (removing from global selectedParts)
    const handlePartUnselect = useCallback((partToRemove) => {
        // Confirmed to remove based on `partToRemove.name`
        onChange(selectedParts.filter((p) => p.name !== partToRemove.name));
    }, [selectedParts, onChange]);

    // Handler for closing the drawer (resets local state)
    const handleDrawerClose = useCallback(() => {
        setIsDrawerOpen(false);
        setDrawerCurrentPart(null); // Clear local state when drawer is closed without submitting
        setDrawerTab(0); // Reset tab for next open
    }, []);

    return (
        <div className="car-body-parts-selector">
            <div>
                <h2>Запчастини</h2>
                <div>
                    {/* Only show SelectionInput if there are unselected parts */}
                    {unselectedParts.length > 0 && (
                        <SelectionInput
                            name="Додати запчастини"
                            labels={carPartsTranslations}
                            values={unselectedParts}
                            selectedValue={null}
                            onChange={handlePartSelect}
                            autoConfirm={false}
                        />
                    )}
                </div>
            </div>

            <div>
                <Divider />
                <PanelGroup className="flex flex-wrap gap-2">
                    {Array.isArray(selectedParts) && selectedParts.length > 0 ? (
                        selectedParts.map((part) => (
                            <Panel
                                style={{ display: 'inline-block', width: 240, margin: "1em", cursor: 'pointer' }}
                                header={carPartsTranslations[part.name] || part.name} // Use translation if available
                                key={part.name}
                                shaded
                                bordered
                                onClick={() => handlePartSelect(part.name)} // Click to re-edit
                            >
                                <p style={{ fontSize: "12px" }}>
                                    {part.action ? actions[part.action] : "Дія не обрана"}
                                </p>
                                <p style={{ fontSize: "10px", color: "#666" }}>
                                    (Клікніть, щоб редагувати)
                                </p>
                                <Button
                                    size="xs"
                                    color="red"
                                    appearance="ghost"
                                    onClick={(e) => {
                                        e.stopPropagation(); // Prevent Panel onClick from firing
                                        handlePartUnselect(part);
                                    }}
                                    style={{ marginTop: '5px' }}
                                >
                                    Видалити
                                </Button>
                            </Panel>
                        ))
                    ) : (
                        <p>Ще немає обраних запчастин. Оберіть зі списку вище.</p>
                    )}
                </PanelGroup>
            </div>

            {drawerCurrentPart && (
                <Drawer
                    open={isDrawerOpen}
                    onClose={handleDrawerClose}
                    className="carBodyParts-drawer"
                    size={'calc(min(100vw, 600px))'}
                >
                    <Drawer.Header>
                        <Drawer.Title>{carPartsTranslations[drawerCurrentPart.name]}</Drawer.Title>
                    </Drawer.Header>
                    <Drawer.Body>
                        <div>
                            <Steps current={drawerTab} small>
                                <Steps.Item title="Тип ремонту" />
                                <Steps.Item title="Деталі" />
                                <Steps.Item title="Розрахунки" />
                            </Steps>
                            <div className="drawer-tabs-container">
                                {drawerTab === 0 && (
                                    <div className="carousel-page">
                                        <RadioTileGroup
                                            value={drawerCurrentPart.action}
                                            onChange={(value) => updateDrawerCurrentPart({ action: value })}
                                        >
                                            {Object.keys(actions).map((key) => (
                                                <RadioTile
                                                    icon={actionsIcons[key]}
                                                    label={actions[key]}
                                                    key={key}
                                                    value={key}
                                                >
                                                    Тут може бути опис операції "{actions[key]}", але наразі його немає.
                                                </RadioTile>
                                            ))}
                                        </RadioTileGroup>
                                        <Divider />
                                        <Button
                                            color='green'
                                            appearance="primary"
                                            block
                                            onClick={() => setDrawerTab(1)}
                                            disabled={!drawerCurrentPart.action} // Disable if no action selected
                                        >
                                            Далі
                                        </Button>
                                    </div>
                                )}
                                {drawerTab === 1 && (
                                    <div>
                                        <p><i>Обрана дія: {actions[drawerCurrentPart.action]}</i></p>
                                        {(drawerCurrentPart.action === "paint_one_side" || drawerCurrentPart.action === "paint_two_sides") && (
                                            <div>
                                                <GridDraw
                                                    gridData={drawerCurrentPart.grid}
                                                    onGridChange={(value) => updateDrawerCurrentPart({ grid: value })}
                                                />
                                                <SelectionInput
                                                    name="Поза зоною ремонту"
                                                    values={Object.keys(outsideRepairZoneOptions)}
                                                    labels={outsideRepairZoneOptions}
                                                    selectedValue={drawerCurrentPart.outsideRepairZone}
                                                    onChange={(value) => updateDrawerCurrentPart({ outsideRepairZone: value })}
                                                />
                                            </div>
                                        )}
                                        <Divider />
                                        <Button color='green' appearance="primary" block onClick={() => setDrawerTab(2)}>
                                            Розрахувати вартість
                                        </Button>
                                        <Button appearance="subtle" block onClick={() => setDrawerTab(0)}>Змінити тип ремонту</Button>
                                    </div>
                                )}
                                {drawerTab === 2 && (
                                    <div>
                                        <h3>Підсумок та розрахунки</h3>
                                        <p>Частина: {carPartsTranslations[drawerCurrentPart.name]}</p>
                                        <p>Дія: {actions[drawerCurrentPart.action]}</p>
                                        {/* Display other details from drawerCurrentPart */}
                                        {(drawerCurrentPart.action === "paint_one_side" || drawerCurrentPart.action === "paint_two_sides") && (
                                            <>
                                                <p>Зона пошкодження: {drawerCurrentPart.grid && drawerCurrentPart.grid.flat().filter(cell => cell === 1).length} клітинок</p>
                                                <p>Поза зоною ремонту: {outsideRepairZoneOptions[drawerCurrentPart.outsideRepairZone]}</p>
                                            </>
                                        )}
                                        {/* Add more calculation details here */}
                                        <Divider />
                                        <Button color='blue' appearance="primary" block onClick={handleAddOrUpdatePart}>
                                            Підтвердити та додати/оновити
                                        </Button>
                                        <Button appearance="subtle" block onClick={() => setDrawerTab(1)}>Повернутися до деталей</Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </Drawer.Body>
                </Drawer>
            )}
        </div>
    );
};

export default CarBodyPartsSelector;