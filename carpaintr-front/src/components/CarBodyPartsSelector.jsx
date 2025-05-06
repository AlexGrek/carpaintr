import React, { useEffect, useState } from "react";
import { Button, Drawer, Steps, Slider, Divider, Panel, PanelGroup, RadioTileGroup, RadioTile, Carousel } from "rsuite";
import { Icon } from '@rsuite/icons';
import GearIcon from '@rsuite/icons/Gear';
import SelectionInput from './SelectionInput'
import PinIcon from '@rsuite/icons/Pin';
import ConversionIcon from '@rsuite/icons/Conversion';
import OneColumnIcon from '@rsuite/icons/OneColumn';
import ColumnsIcon from '@rsuite/icons/Columns';
import { useGlobalCallbacks } from "./GlobalCallbacksContext";
import './CarBodyPartsSelector.css'
import GridDraw from "./GridDraw";

const CarBodyPartsSelector = ({ onChange, selectedParts }) => {
    // const { showReportIssueForm } = useGlobalCallbacks();
    const [unselectedParts, setUnselectedParts] = useState([
        "Hood",
        "Front Bumper",
        "Rear Bumper",
        "Left Front Door",
        "Right Front Door",
        "Left Rear Door",
        "Right Rear Door",
        "Trunk",
        "Left Front Fender",
        "Right Front Fender",
    ]);

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


    const [currentPart, setCurrentPart] = useState(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [drawerTab, setDrawerTab] = useState(0);

    const actions = {
        "polish": "Полірування",
        "replace_and_paint_used": "Заміна з фарбуванням (Б/У деталь)",
        "replace_and_paint_3rdparty": "Заміна з фарбуванням (неоригінальна деталь)",
        "replace_and_paint_original": "Заміна з фарбуванням (оригінальна деталь)",
        "paint_one_side": "Ремонт з фарбуванням зовнішньої сторони",
        "paint_two_sides": "Ремонт з фарбуванням обох сторін"
    }

    const actionsIcons = {
        "polish": <PinIcon />,
        "replace_and_paint_used": <ConversionIcon />,
        "replace_and_paint_3rdparty": <ConversionIcon />,
        "replace_and_paint_original": <ConversionIcon />,
        "paint_one_side": <OneColumnIcon />,
        "paint_two_sides": <ColumnsIcon />
    }

    const generateInitialGrid = (rows, cols) => {
        const grid = [];
        for (let y = 0; y < rows; y++) {
          const row = [];
          for (let x = 0; x < cols; x++) {
            row.push(Math.random() < 0.1 ? -1 : 0); // 10% chance to be disabled (-1), otherwise 0
          }
          grid.push(row);
        }
        return grid;
      };

    const handlePartSelect = (part) => {
        const newPart = {
            action: null,
            replace: false,
            original: true,
            damageLevel: 0,
            name: part,
            grid: generateInitialGrid(10, 15),
            outsideRepairZone: null
        };
        setCurrentPart(newPart);
        setIsDrawerOpen(true);
        setDrawerTab(0)
    };

    const outsideRepairZoneOptions = {
        "no": "без пошкоджень",
        "slightly": "незначні пошкодження",
        "remove": "треба видалити"
    }

    const handleDetailsSubmit = () => {
        onChange([...selectedParts, currentPart]);
        setUnselectedParts(unselectedParts.filter((part) => part !== currentPart.name));
        setIsDrawerOpen(false);
        setCurrentPart(null);
    };

    const handlePartUnselect = (part) => {
        setUnselectedParts([...unselectedParts, part.name]);
        onChange(selectedParts.filter((p) => p.name !== part.name));
    };

    const updateCurrentPart = (part) => {
        if (currentPart.action != part.action) {
            // we are updating first page, so...
            setDrawerTab(1)
            console.log("drawer next tab");
        }
        setCurrentPart(part)
        // console.log(`Update!\n${JSON.stringify(part)}`)
        // Create a copy of the selectedParts array
        const updatedSelectedParts = selectedParts.map((existingPart) => {
            // Check if the part already exists in the array (by name)
            if (existingPart.name === part.name) {
                // Return a copy of the updated part
                return { ...existingPart, ...part };
            }
            // Return the original part if it's not the one we're updating
            return existingPart;
        });

        // Check if the part was found and updated; if not, add it to the end
        const partExists = updatedSelectedParts.some(
            (existingPart) => existingPart.name === part.name
        );

        if (!partExists) {
            updatedSelectedParts.push({ ...part });
            setUnselectedParts(unselectedParts.filter(item => item != part.name))
        }

        // Call the onChange callback with the updated array
        onChange(updatedSelectedParts);
    };

    return (
        <div className="">
            <div className="">
                <div>
                    <h2 className="">Запчастини</h2>
                    <div>
                        {unselectedParts.length > 0 && <SelectionInput name="Додати запчастини" labels={carPartsTranslations} values={unselectedParts} selectedValue={null} onChange={handlePartSelect} autoConfirm={false} />}
                    </div>
                </div>

                <div>
                    <Divider />
                    <PanelGroup className="flex flex-wrap gap-2">
                        {Array.isArray(selectedParts) && selectedParts.map((part) => (
                            <Panel
                                style={{ display: 'inline-block', width: 240, margin: "1em" }}
                                header={part.name}
                                key={part.name}
                                shaded bordered
                                onClick={() => handlePartUnselect(part)}
                            >
                                <p style={{ fontSize: "12px" }}>
                                    {part.replace ? "Replace" : "Repair"} |{" "}
                                    {part.original ? "Original" : "Aftermarket"} | Damage:{" "}
                                    {part.damageLevel}
                                </p>
                            </Panel>
                        ))}
                    </PanelGroup>
                </div>

                {currentPart && (
                    <Drawer open={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} className="carBodyParts-drawer" size={'calc(min(100vw, 600px))'}>
                        <Drawer.Header>
                            <Drawer.Title>{carPartsTranslations[currentPart.name]}</Drawer.Title>
                        </Drawer.Header>
                        <Drawer.Body>
                            <div>
                                <Steps current={drawerTab} small>
                                    <Steps.Item title="Тип ремонту" />
                                    <Steps.Item title="Деталі" />
                                    <Steps.Item title="Розрахунки" />
                                </Steps>
                                <div className="drawer-tabs-container">
                                    {drawerTab == 0 && <div className="carousel-page">
                                        <RadioTileGroup value={currentPart.action} onChange={(value) => updateCurrentPart({ ...currentPart, action: value })}>
                                            {Object.keys(actions).map((key) => {
                                                return <RadioTile icon={actionsIcons[key]} label={actions[key]} key={key} value={key}>
                                                    Тут може бути опис операції "{actions[key]}", але наразі його немає.
                                                </RadioTile>
                                            })}
                                        </RadioTileGroup>
                                    </div>}
                                    {drawerTab == 1 && <div>
                                        <p><i>{actions[currentPart.action]}</i></p>
                                        {(currentPart.action === "paint_one_side" || currentPart.action === "paint_two_sides") && <div>
                                            <GridDraw gridData={currentPart.grid} onGridChange={(value) => updateCurrentPart({ ...currentPart, grid: value })}/>
                                        <SelectionInput name="Поза зоною ремонту" values={Object.keys(outsideRepairZoneOptions)} labels={outsideRepairZoneOptions} selectedValue={currentPart.outsideRepairZone} onChange={(value) => updateCurrentPart({ ...currentPart, outsideRepairZone: value })} />
                                        </div>}
                                        <Divider/>
                                        <Button color='green' appearance="primary" block onClick={() => setDrawerTab(2)}>
                                                Розрахувати вартість
                                            </Button>
                                            <Button appearance="subtle" block onClick={() => setDrawerTab(0)}>Змінити тип ремонту</Button>
                                    </div>}
                                    {drawerTab == 2 && <div>

                                    </div>}
                                </div>

                            </div>
                        </Drawer.Body>
                    </Drawer>
                )}
            </div>
        </div>
    );
};

export default CarBodyPartsSelector;
