import React, { useState, useEffect, useCallback } from 'react';
import { SelectPicker, Button, DatePicker, Grid, Col, Row, VStack, Stack, Tabs, Placeholder, PanelGroup, Panel } from 'rsuite';
import { authFetch, authFetchYaml } from '../utils/authFetch';
import SelectionInput from './SelectionInput'; // Assuming SelectionInput is also optimized with React.memo
import { Toggle } from 'rsuite';
import { useNavigate } from "react-router-dom";
import Trans from '../localization/Trans';
import { useLocale } from '../localization/LocaleContext';
import { useGlobalCallbacks } from "./GlobalCallbacksContext"; // Ensure this context is stable

// Lazy load components for better initial bundle size
const CarBodyPartsSelector = React.lazy(() => import('./CarBodyPartsSelector'));
const ColorGrid = React.lazy(() => import('./ColorGrid')); // Used by ColorPicker

// Pre-map static lists for SelectPicker data to avoid re-mapping on every render
const CAR_CLASS_OPTIONS = [
    "A", "B", "C", "D", "E", "F", "SUV 1", "SUV 2", "SUV MAX"
].map((i) => ({ label: i, value: i }));

const CAR_BODY_TYPES_OPTIONS = [
    "hatchback 3 doors",
    "hatchback 5 doors",
    "sedan", "cabriolet", "liftback",
    "wagon", "coupe",
    "suv 5 doors",  "suv 3 doors",
    "pickup"
].map((i) => ({ label: i, value: i }));

// Memoized CurrentDateDisplay to prevent unnecessary re-renders
const CurrentDateDisplay = React.memo(() => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [season, setSeason] = useState(null);
    const [seasonDetails, setSeasonDetails] = useState(null);

    useEffect(() => {
        authFetch('/api/v1/user/season')
            .then(response => response.json())
            .then((data) => {
                setCurrentDate(new Date());
                setSeason(data.season_name === "summer" ? "Літо" : "Зима");
                setSeasonDetails(JSON.stringify(data));
            })
            .catch(console.error);
    }, []); // Empty dependency array means this runs once on mount

    return (
        <div>
            <DatePicker value={currentDate} disabled />
            <p>Розрахунковий сезон: {season}</p>
            <p><small>{JSON.stringify(seasonDetails)}</small></p>
        </div>
    );
});

// Memoized ColorPicker to prevent unnecessary re-renders
const ColorPicker = React.memo(({ setColor, selectedColor }) => {
    const [baseColors, setBaseColors] = useState({});

    useEffect(() => {
        const fetchData = async () => {
            try {
                let data = await authFetchYaml('/api/v1/user/global/colors.json');
                setBaseColors(data);
            } catch (error) {
                console.error("Failed to fetch colors:", error);
                // Handle error appropriately, e.g., show an error message
            }
        };
        fetchData();
    }, []); // Empty dependency array means this runs once on mount

    if (baseColors.rows === undefined) {
        return <Placeholder.Paragraph rows={3} />; // Show a placeholder while loading
    }

    const displayColors = baseColors.rows;

    return (
        <div>
            {displayColors.map((subgrid, index) => (
                // Add a unique key for list rendering
                <React.Suspense key={index} fallback={<Placeholder.Paragraph rows={1} />}>
                    <ColorGrid colors={subgrid} selectedColor={selectedColor} onChange={setColor} />
                </React.Suspense>
            ))}
        </div>
    );
});

// Memoized VehicleSelect to prevent unnecessary re-renders
const VehicleSelect = React.memo(({ selectedBodyType, setBodyType, selectedMake, selectedModel, setMake, setModel, setYear, carclass, setCarClass }) => {
    const [makes, setMakes] = useState([]);
    const [models, setModels] = useState({});
    const [bodyTypes, setBodyTypes] = useState([]);

    const navigate = useNavigate();

    const handleError = useCallback((reason) => {
        console.error(reason);
        navigate("/cabinet");
    }, [navigate]);

    useEffect(() => {
        authFetch('/api/v1/user/carmakes')
            .then(response => {
                if (response.status === 403) {
                    navigate("/cabinet");
                    return null; // Stop here, don't try to parse JSON
                }
                if (!response.ok) {
                    throw new Error(`HTTP error ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (data) setMakes(data); // Only set if data was parsed
            })
            .catch(handleError);
    }, [navigate, handleError]); // Add handleError to dependencies

    useEffect(() => {
        setBodyTypes([]);
        setModel(null);
        setModels({});
        setBodyType(null);
        if (selectedMake === null) {
            return;
        }
        setModel(null); // Reset model selection on make change
        authFetch(`/api/v1/user/carmodels/${selectedMake}`)
            .then(response => response.json())
            .then(setModels)
            .catch(console.error);
    }, [selectedMake, setModel, setBodyTypes, setBodyType, setModels]); // Explicit dependencies

    const handleMakeSelect = useCallback((make) => {
        setMake(make);
    }, [setMake]);

    const handleModelSelect = useCallback((model) => {
        setModel(model);
        console.log(`Model: ${model}`);
        console.log(`Model object: ${JSON.stringify(models[model])}`);
        if (models[model] !== undefined) {
            setBodyTypes(models[model]["euro_body_types"]);
            setCarClass(models[model]["euro_class"]);
        } else {
            setBodyTypes([]);
            setBodyType(null);
        }
    }, [setModel, models, setBodyTypes, setCarClass, setBodyType]);

    const capitalizeFirstLetter = useCallback((val) => {
        return String(val).charAt(0).toUpperCase() + String(val).slice(1);
    }, []);

    const modelOptions = Object.keys(models);

    return (
        <div>
            <Tabs defaultActiveKey="1" appearance="pills">
                <Tabs.Tab eventKey="1" title="Models" style={{width: "100%"}}>
                    <SelectionInput name="Марка" values={makes} labelFunction={capitalizeFirstLetter} selectedValue={selectedMake} onChange={handleMakeSelect} placeholder="Select Make" />
                    {selectedMake !== null && <SelectionInput name="Модель" selectedValue={selectedModel} values={modelOptions} onChange={handleModelSelect} placeholder="Select Model" />}
                    {selectedModel !== null && <SelectionInput name="Тип кузова" selectedValue={selectedBodyType} values={bodyTypes} onChange={setBodyType} placeholder="Select Body Type" />}
                </Tabs.Tab>
                <Tabs.Tab eventKey="2" title="Type/Class">
                    <SelectPicker
                        data={CAR_CLASS_OPTIONS}
                        onSelect={setCarClass}
                        value={carclass}
                        placeholder="КЛАС"
                    />
                    <SelectPicker
                        data={CAR_BODY_TYPES_OPTIONS}
                        onSelect={setBodyType}
                        value={selectedBodyType}
                        placeholder="ТИП КУЗОВА"
                    />
                </Tabs.Tab>
            </Tabs>
            <SelectPicker
                disabled={!(selectedModel !== null || (carclass !== null && selectedBodyType !== null))}
                data={[...Array(30)].map((_, i) => ({ label: `${2024 - i}`, value: 2024 - i }))}
                onSelect={setYear}
                placeholder="Рік випуску"
            />
        </div>
    );
});

// Main Parent component
const CarPaintEstimator = () => {
    const { showReportIssueForm } = useGlobalCallbacks(); // Ensure this is stable, possibly memoize
    const [make, setMake] = useState(null);
    const [model, setModel] = useState(null);
    const [year, setYear] = useState(null);
    const [carClass, setCarClass] = useState(null);
    const [bodyType, setBodyType] = useState(null);
    const [color, setColor] = useState(null);
    const [selectedParts, setSelectedParts] = useState([]);
    const [activePanel, setActivePanel] = useState(1);
    const [paintType, setPaintType] = useState(null);

    // No need for `typeclass` if it's not used

    // No need for this useEffect, activeKey handles panel activation
    // useEffect(() => {
    //     if (bodyType == null) {
    //         return;
    //     }
    // }, [bodyType])

    const activeKey = () => {
        if (make !== null && year !== null && model !== null) {
            return 2;
        }
        return 1;
    };

    const handleSetYear = useCallback((yearVal) => {
        setYear(yearVal);
        setActivePanel(2);
    }, []);

    const paintTypesAndTranslations = {
        "simple": "Без вкраплень",
        "metallic": "Металлік",
        "pearl": "Перламутр",
        "special": "Спец еффект"
    };

    const handleSetMake = useCallback((val) => setMake(val), []);
    const handleSetModel = useCallback((val) => setModel(val), []);
    const handleSetCarClass = useCallback((val) => setCarClass(val), []);
    const handleSetBodyType = useCallback((val) => setBodyType(val), []);
    const handleSetColor = useCallback((val) => setColor(val), []);
    const handleSetPaintType = useCallback((val) => setPaintType(val), []);
    const handleSetSelectedParts = useCallback((val) => setSelectedParts(val), []);


    return (
        <div>
            <Stack wrap justifyContent='space-between'>
                <h3>Розрахунок вартості ремонту</h3>
                <Button appearance="link" color="red" size="xs" onClick={showReportIssueForm}>
                    Повідомити про проблему
                </Button>
            </Stack>
            <PanelGroup accordion defaultActiveKey={activeKey()} activeKey={activePanel} bordered onSelect={(key) => setActivePanel(parseInt(key))}>
                <Panel header={year === null ? "Автомобіль" : `${make} ${model} ${year} / ${carClass || ''} ${bodyType || ''}`} eventKey={1}>
                    <VehicleSelect
                        selectedBodyType={bodyType}
                        carclass={carClass}
                        setCarClass={handleSetCarClass}
                        selectedMake={make}
                        selectedModel={model}
                        setMake={handleSetMake}
                        setBodyType={handleSetBodyType}
                        setModel={handleSetModel}
                        setYear={handleSetYear}
                    />
                </Panel>
                <Panel header="Колір та тип фарби" eventKey={2}>
                    <React.Suspense fallback={<Placeholder.Paragraph rows={8} />}>
                        <ColorPicker setColor={handleSetColor} selectedColor={color} />
                    </React.Suspense>
                    <VStack justifyContent='center' alignItems='center' style={{ margin: "40px" }}>
                        <SelectionInput name="Тип фарби" values={Object.keys(paintTypesAndTranslations)} labels={paintTypesAndTranslations} selectedValue={paintType} onChange={handleSetPaintType} placeholder="Select paint type" />
                    </VStack>
                    <Button onClick={() => setActivePanel(3)} disabled={paintType === null || color === null} color='green' appearance='primary'>Прийняти</Button>
                </Panel>
                <Panel header="Роботи" eventKey={3}>
                    {bodyType !== null && (
                        <React.Suspense fallback={<Placeholder.Paragraph rows={8} />}>
                            <CarBodyPartsSelector selectedParts={selectedParts} onChange={handleSetSelectedParts} carClass={carClass} body={bodyType} />
                        </React.Suspense>
                    )}
                </Panel>
                <Panel header="Додатково" eventKey={4}>
                    <CurrentDateDisplay />
                </Panel>
            </PanelGroup>
        </div>
    );
};

export default CarPaintEstimator;