import { useEffect, useState, useCallback } from "react";
import { Button, Drawer, Steps, Divider, Panel, PanelGroup, VStack } from "rsuite";
import SelectionInput from '../SelectionInput'
import { useMediaQuery } from 'react-responsive';
import GridDraw from "./GridDraw";
import { authFetch } from '../../utils/authFetch'; // Assuming authFetch is used, not authFetchYaml
import './CarBodyPartsSelector.css'
import { useLocale } from "../../localization/LocaleContext";
import ErrorMessage from "../layout/ErrorMessage";
import { Focus, Grid2x2X, Grid2x2Plus, Handshake } from 'lucide-react';
import MenuTree from "../layout/MenuTree";
import './CarBodyPartsSelector.css';
import jsyaml from 'js-yaml';
import CalculationTable from "./CalculationTable";
import { stripExt } from "../../utils/utils";
import { evaluate_processor, make_sandbox, make_sandbox_extensions, should_evaluate_processor, validate_requirements, verify_processor } from "../../calc/processor_evaluator";
import { EvaluationResultsTable } from "./EvaluationResultsTable";
import ObjectBrowser from "../utility/ObjectBrowser";
import BottomStickyLayout from "../layout/BottomStickyLayout";

const exampleCalcFunction = (data) => {
    return data.map(item => ({
        operation: item.name,
        estimation: item.hours,
        price: item.hours * item.rate,
    }));
};

const exampleData = [
    { name: 'Welding', hours: 3, rate: 50 },
    { name: 'Painting', hours: 2, rate: 40 },
];

const menuItems = [
    {
        label: 'Ремонт',
        subitems: [
            { label: 'З фарбуванням обох сторін', value: 'paint_two_sides' },
            { label: 'З фарбуванням зовнішньої сторони', value: 'paint_one_side' },
            {
                label: 'Без фарбування',
                value: 'repair_no_paint'
            },
        ],
    },
    { label: 'Тільки полірування', value: 'polish' },
    {
        label: 'Заміна з фарбуванням',
        subitems: [
            { label: 'Оригінальна деталь', value: 'replace_and_paint_original' },
            { label: 'Неоригінальна деталь', value: 'replace_and_paint_3rdparty' },
            { label: 'Б/У деталь', value: 'replace_and_paint_used' },
        ],
    },
    { label: 'Заміна без фарбування', value: 'replace_no_paint' },
];

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

const CarBodyPartsSelector = ({ onChange, selectedParts, calculations, setCalculations, body, carClass, partsVisual }) => {
    const isMobile = useMediaQuery({ maxWidth: 767 });

    const { str } = useLocale();
    const [errorText, setErrorText] = useState(null);
    const [errorTitle, setErrorTitle] = useState("");

    const handleError = useCallback((reason) => {
        console.error(reason);
        const title = str("Error");
        setErrorText(reason);
        setErrorTitle(title);
    }, [str]);

    const mapVisual = useCallback((partName) => {
        // console.log(partName);
        // console.log(partsVisual);
        let entry = partName;
        if (entry && partsVisual[entry]) {
            return partsVisual[entry];
        } else {
            return partsVisual.default;
        }
    }, [partsVisual]);

    // State for available parts fetched from the API
    const [availableParts, setAvailableParts] = useState([]);
    // State for parts not yet selected by the user, derived from availableParts
    const [unselectedParts, setUnselectedParts] = useState([]);

    const [processors, setProcessors] = useState([]);
    const [tableDataRepository, setTableDataRepository] = useState({});

    // Local state for the part being currently configured in the drawer
    const [drawerCurrentPart, setDrawerCurrentPart] = useState(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [drawerTab, setDrawerTab] = useState(0);

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
        // console.log(availableParts)
    }, [availableParts, selectedParts]); // Add selectedParts as a dependency

    // Effect to fetch available car parts from the API
    useEffect(() => {
        if (carClass == null || body == null) {
            return;
        }

        // Reset availableParts and unselectedParts when carClass or body changes
        setAvailableParts([]);
        setUnselectedParts([]);

        authFetch("/api/v1/user/processors_bundle")
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Failed to fetch plugin bundle: ${response.status}`);
                }
                return response.text();
            })
            .then(code => {
                const sandbox = { exports: {}, ...make_sandbox_extensions() };
                new Function("exports", code)(sandbox.exports);
                const plugins = sandbox.exports.default.map(p => verify_processor(p));
                setProcessors(plugins);
                // console.log("Plugins initialized", plugins, jsyaml.dump(JSON.parse(JSON.stringify(sandbox))));
            })
            .catch(handleError);

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
                handleError("Error fetching car parts: " + err);
            });
    }, [body, carClass, handleError]); // Dependencies for API fetch

    // Helper to generate initial grid data
    const generateInitialGrid = useCallback((visual) => {
        const rows = visual.y;
        const cols = visual.x;
        const grid = [];
        for (let y = 0; y < rows; y++) {
            const row = [];
            for (let x = 0; x < cols; x++) {
                row.push(visual.unused.includes(`${x},${y}`) ? -1 : 0);
            }
            grid.push(row);
        }
        // console.log("Grid generated for ", JSON.stringify(visual));
        return grid;
    }, []);

    const getOrFetchTableData = useCallback((partName) => {
        if (tableDataRepository[partName] != undefined) {
            return tableDataRepository[partName];
        }
        // fetch
        const params = new URLSearchParams({
            car_class: carClass,
            car_type: body,
            part: partName
        });
        authFetch(`/api/v1/user/lookup_all_tables?${params}`)
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
                if (data) {
                    const preprocessedTables = data.map((table) => {
                        let name = stripExt(table[0]);
                        let file = table[0];
                        let data = table[1];
                        return {
                            name, data, file
                        }
                    })
                    setTableDataRepository((repo) => { return { ...repo, [partName]: preprocessedTables } })
                };
            })
            .catch((err) => {
                console.error("Error fetching car parts table data:", err);
                handleError("Error fetching table data: " + err);
            });
        return {};
    }, [body, carClass, handleError, tableDataRepository])

    useEffect(() => {
        if (drawerCurrentPart) {
            // not null or undefined
            if (tableDataRepository[drawerCurrentPart.name] != undefined) {
                setDrawerCurrentPart((part) => { return { ...part, tableData: tableDataRepository[drawerCurrentPart.name] } })
            }
        }
    }, [tableDataRepository])

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
                grid: generateInitialGrid(mapVisual(partName ? partName : "")),
                outsideRepairZone: null,
                tableData: getOrFetchTableData(partName)
            };

        setDrawerCurrentPart(newPart);
        setIsDrawerOpen(true);
        setDrawerTab(0); // Always start from the first tab
    }, [selectedParts, generateInitialGrid, mapVisual, getOrFetchTableData]);

    // Handler for updating the local drawerCurrentPart state
    const updateDrawerCurrentPart = useCallback((updates) => {
        setDrawerCurrentPart(prevPart => {
            const updatedPart = { ...prevPart, ...updates };
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

    useEffect(() => {
        /* {
                action: null,
                replace: false,
                original: true,
                damageLevel: 0,
                name: partName,
                grid: generateInitialGrid(mapVisual(partName ? partName : "")),
                outsideRepairZone: null,
                tableData: getOrFetchTableData(partName)
            }; */
        // const { carPart, tableData, repairAction, files, carClass, carBodyType, carYear, carModel, paint } = stuff;
        if (drawerCurrentPart && drawerTab == 2) {
            const tdata = drawerCurrentPart.tableData.reduce((acc, item) => {
                acc[item.name] = item.data;
                return acc;
            }, {});
            const stuff = {
                name: drawerCurrentPart.name,
                repairAction: drawerCurrentPart.action,
                files: [],
                carClass: carClass,
                carBodyType: body,
                carYear: 1999,
                carModel: {},
                tableData: tdata,
                paint: {} // TODO: make it useful
            };

            let processorsEvaluated = processors
                .map((proc) => {
                let missing = validate_requirements(proc, tdata);
                if (missing == null) {
                    if (should_evaluate_processor(proc, stuff)) {
                        return evaluate_processor(proc, stuff);
                    } else {
                        return "Condition not met to run processor " + proc.name;
                    }
                }
                return `Data not ready (${missing} is missing): ${JSON.stringify(tdata, null, 2)}`;
            });
            setCalculations({ ...calculations, [drawerCurrentPart.name]: processorsEvaluated });
        }
    }, [drawerTab, drawerCurrentPart, carClass, body, processors])

    return (
        <div className="car-body-parts-selector">
            <ErrorMessage errorText={errorText} onClose={() => setErrorText(null)} title={errorTitle} />
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
                    backdrop='static'
                    size={isMobile ? "full" : "md"}
                >
                    <Drawer.Header>
                        <Drawer.Title>{drawerCurrentPart.name}</Drawer.Title>
                    </Drawer.Header>
                    <Drawer.Body>
                        <div>
                            <Steps current={drawerTab} small style={{ color: "black" }}>
                                <Steps.Item icon={<Focus />} title="Тип ремонту" />
                                <Steps.Item icon={<Grid2x2X />} title="Деформації" />
                                <Steps.Item icon={<Grid2x2Plus />} title="Пошкодження" />
                                <Steps.Item icon={<Handshake />} title="Розрахунки" />
                            </Steps>
                            <div className="drawer-tabs-container">
                                {drawerTab === 0 && (
                                    <div className="carousel-page">
                                        <h4 className="body-parts-tab-header">Оберіть дію</h4>
                                        <MenuTree items={menuItems} value={drawerCurrentPart.action} onChange={(value) => updateDrawerCurrentPart({ action: value })} />
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
                                        <p style={{ opacity: '0.4', fontSize: 'x-small' }}><pre>{jsyaml.dump(drawerCurrentPart)}</pre></p>
                                    </div>
                                )}
                                {drawerTab === 1 && (
                                    <BottomStickyLayout bottomPanel={<VStack>
                                        <Button color='green' appearance="primary" block onClick={() => setDrawerTab(2)}>
                                            Розрахувати вартість
                                        </Button>
                                        <Button appearance="subtle" block onClick={() => setDrawerTab(0)}>Змінити тип ремонту</Button>
                                    </VStack>}>
                                        <h4 className="body-parts-tab-header">Вкажіть зону ремонту</h4>
                                        {(drawerCurrentPart.action === "paint_one_side" || drawerCurrentPart.action === "paint_two_sides") && (
                                            <div>
                                                <GridDraw
                                                    gridData={drawerCurrentPart.grid}
                                                    visual={mapVisual(drawerCurrentPart.name)}
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

                                    </BottomStickyLayout>
                                )}
                                {drawerTab === 2 && (
                                    <BottomStickyLayout bottomPanel={<VStack>
                                        <Button color='blue' appearance="primary" block onClick={handleAddOrUpdatePart}>
                                            Підтвердити та додати/оновити
                                        </Button>
                                        <Button appearance="subtle" block onClick={() => setDrawerTab(1)}>Повернутися до деталей</Button>
                                    </VStack>}>
                                        <h3>Підсумок та розрахунки</h3>
                                        <EvaluationResultsTable
                                            data={calculations[drawerCurrentPart.name] || []}
                                        />
                                        <Panel shaded collapsible header="Дані">
                                            <ObjectBrowser jsonObject={drawerCurrentPart.tableData} />
                                        </Panel>
                                        {/* Display other details from drawerCurrentPart */}
                                        {(drawerCurrentPart.action === "paint_one_side" || drawerCurrentPart.action === "paint_two_sides") && (
                                            <>
                                                <p>Зона пошкодження: {drawerCurrentPart.grid && drawerCurrentPart.grid.flat().filter(cell => cell === 1).length} клітинок</p>
                                                <p>Поза зоною ремонту: {outsideRepairZoneOptions[drawerCurrentPart.outsideRepairZone]}</p>
                                            </>
                                        )}
                                    </BottomStickyLayout>

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