/* eslint-disable react/display-name */
import React, { useState, useEffect, useCallback } from 'react';
import { SelectPicker, Button, DatePicker, VStack, Stack, Tabs, Placeholder, PanelGroup, Panel, Message, useToaster } from 'rsuite';
import { authFetch, authFetchYaml } from '../utils/authFetch';
import SelectionInput from './SelectionInput'; // Assuming SelectionInput is also optimized with React.memo
import { useNavigate } from "react-router-dom";
import Trans from '../localization/Trans';
import { useLocale, registerTranslations } from '../localization/LocaleContext'; // Import registerTranslations
import { useGlobalCallbacks } from "./GlobalCallbacksContext"; // Ensure this context is stable
import { Helmet } from 'react-helmet-async';

// Lazy load components for better initial bundle size
const CarBodyPartsSelector = React.lazy(() => import('./CarBodyPartsSelector'));
const ColorGrid = React.lazy(() => import('./ColorGrid')); // Used by ColorPicker

registerTranslations('ua', {
    "Loading...": "Завантаження...",
    "Models": "Моделі",
    "Type/Class": "Тип/Клас",
    "Select Make": "Виберіть марку",
    "Select Model": "Виберіть модель",
    "Select Body Type": "Виберіть тип кузова",
    "CLASS": "КЛАС",
    "BODY TYPE": "ТИП КУЗОВА",
    "Year of manufacture": "Рік випуску",
    "Cost of repair calculation": "Розрахунок вартості ремонту",
    "Save": "Зберегти",
    "Load from server": "Завантажити з сервера",
    "Report a problem": "Повідомити про проблему",
    "Car": "Автомобіль",
    "Color and paint type": "Колір та тип фарби",
    "Accept": "Прийняти",
    "Works": "Роботи",
    "Additional": "Додатково",
    "Calculated season": "Розрахунковий сезон",
    "No inclusions": "Без вкраплень",
    "Metallic": "Металік",
    "Pearl": "Перламутр",
    "Special effect": "Спец ефект",
    "Calculation saved successfully!": "Розрахунок успішно збережено!",
    "Failed to save calculation:": "Не вдалося зберегти розрахунок:",
    "Error saving calculation:": "Помилка при збереженні розрахунку:",
    "No saved calculation found.": "Збережених розрахунків не знайдено.",
    "Calculation loaded successfully!": "Розрахунок успішно завантажено!",
    "Failed to load calculation:": "Не вдалося завантажити розрахунок:",
    "Error loading calculation:": "Помилка при завантаженні розрахунку:",
    "Paint type": "Тип фарби"
});

// Pre-map static lists for SelectPicker data to avoid re-mapping on every render
const CAR_CLASS_OPTIONS = [
    "A", "B", "C", "D", "E", "F", "SUV 1", "SUV 2", "SUV MAX"
].map((i) => ({ label: i, value: i }));

const CAR_BODY_TYPES_OPTIONS = [
    "hatchback 3 doors",
    "hatchback 5 doors",
    "sedan", "cabriolet", "liftback",
    "wagon", "coupe",
    "suv 5 doors", "suv 3 doors",
    "pickup"
].map((i) => ({ label: i, value: i }));

// Memoized CurrentDateDisplay to prevent unnecessary re-renders
const CurrentDateDisplay = React.memo(() => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [season, setSeason] = useState(null);
    const [seasonDetails, setSeasonDetails] = useState(null);
    const { str } = useLocale();

    useEffect(() => {
        authFetch('/api/v1/user/season')
            .then(response => response.json())
            .then((data) => {
                setCurrentDate(new Date());
                setSeason(data.season_name === "summer" ? str("Літо") : str("Зима")); // Assuming "Літо" and "Зима" are already in translation map or can be added
                setSeasonDetails(JSON.stringify(data));
            })
            .catch(console.error);
    }, []); // Empty dependency array means this runs once on mount

    return (
        <div>
            <DatePicker value={currentDate} disabled />
            <p><Trans>Calculated season</Trans>: {season}</p>
            <p><small>{JSON.stringify(seasonDetails)}</small></p>
        </div>
    );
});

// Memoized ColorPicker to prevent unnecessary re-renders
const ColorPicker = React.memo(({ setColor, selectedColor }) => {
    const [baseColors, setBaseColors] = useState({});
    const { str } = useLocale();

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

    if (baseColors == null || baseColors.rows === undefined) {
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
    const { str } = useLocale();
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
                <Tabs.Tab eventKey="1" title={str("Models")} style={{ width: "100%" }}>
                    <SelectionInput name={str("Make")} values={makes} labelFunction={capitalizeFirstLetter} selectedValue={selectedMake} onChange={handleMakeSelect} placeholder={str("Select Make")} />
                    {selectedMake !== null && <SelectionInput name={str("Model")} selectedValue={selectedModel} values={modelOptions} onChange={handleModelSelect} placeholder={str("Select Model")} />}
                    {selectedModel !== null && <SelectionInput name={str("Body Type")} selectedValue={selectedBodyType} values={bodyTypes} onChange={setBodyType} placeholder={str("Select Body Type")} />}
                </Tabs.Tab>
                <Tabs.Tab eventKey="2" title={str("Type/Class")}>
                    <SelectPicker
                        data={CAR_CLASS_OPTIONS}
                        onSelect={setCarClass}
                        value={carclass}
                        placeholder={str("CLASS")}
                    />
                    <SelectPicker
                        data={CAR_BODY_TYPES_OPTIONS}
                        onSelect={setBodyType}
                        value={selectedBodyType}
                        placeholder={str("BODY TYPE")}
                    />
                </Tabs.Tab>
            </Tabs>
            <SelectPicker
                disabled={!(selectedModel !== null || (carclass !== null && selectedBodyType !== null))}
                data={[...Array(30)].map((_, i) => ({ label: `${2024 - i}`, value: 2024 - i }))}
                onSelect={setYear}
                placeholder={str("Year of manufacture")}
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
    const [storeFileName, setStoreFileName] = useState(null);
    const toaster = useToaster();
    const { str } = useLocale();

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
        "simple": str("No inclusions"),
        "metallic": str("Metallic"),
        "pearl": str("Pearl"),
        "special": str("Special effect")
    };

    const handleSetMake = useCallback((val) => setMake(val), []);
    const handleSetModel = useCallback((val) => setModel(val), []);
    const handleSetCarClass = useCallback((val) => setCarClass(val), []);
    const handleSetBodyType = useCallback((val) => setBodyType(val), []);
    const handleSetColor = useCallback((val) => setColor(val), []);
    const handleSetPaintType = useCallback((val) => setPaintType(val), []);
    const handleSetSelectedParts = useCallback((val) => setSelectedParts(val), []);

    const showMessage = useCallback((type, message) => {
        toaster.push(
            <Message type={type} closable duration={5000}>
                {message}
            </Message>,
            { placement: 'topEnd' }
        );
    }, [toaster]);

    const handleSave = useCallback(async () => {
        const dataToSave = {
            model: (make && model) ? { brand: make, model: model } : null,
            year: year ? String(year) : "",
            body_type: bodyType || "",
            car_class: carClass || "",
            color: color || "",
            paint_type: paintType || "",
            saved_file_name: storeFileName || null,
            body_parts: selectedParts.length > 0 ? selectedParts.map(part => ({ brand: make || "", model: part })) : null,
            // timestamp will be added on the backend
        };

        try {
            const response = await authFetch('/api/v1/user/calculationstore', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(dataToSave),
            });
            if (response.ok) {
                showMessage('success', str('Calculation saved successfully!'));
                const data = await response.json();
                console.log("Got data: " + JSON.stringify(data));
                setStoreFileName(data.saved_file_path || null);
            } else {
                const errorData = await response.json();
                showMessage('error', `${str('Failed to save calculation:')} ${errorData.message || response.statusText}`);
            }
        } catch (error) {
            console.error("Error saving calculation:", error);
            showMessage('error', `${str('Error saving calculation:')} ${error.message}`);
        }
    }, [make, model, year, bodyType, carClass, color, paintType, selectedParts, showMessage, storeFileName, str]);

    const handleLoad = useCallback(async () => {
        try {
            const response = await authFetch(`/api/v1/user/calculationstore?filename=${storeFileName}`);
            if (response.ok) {
                const data = await response.json();
                if (data) {
                    setMake(data.model?.brand || null);
                    setModel(data.model?.model || null);
                    setYear(data.year ? parseInt(data.year, 10) : null);
                    setBodyType(data.body_type || null);
                    setCarClass(data.car_class || null);
                    setColor(data.color || null);
                    setPaintType(data.paint_type || null);
                    setSelectedParts(data.body_parts?.map(part => part.model) || []);
                    showMessage('success', str('Calculation loaded successfully!'));
                    setStoreFileName(data.saved_file_name || null);
                } else {
                    showMessage('info', str('No saved calculation found.'));
                }
            } else {
                const errorData = await response.json();
                showMessage('error', `${str('Failed to load calculation:')} ${errorData.message || response.statusText}`);
            }
        } catch (error) {
            console.error("Error loading calculation:", error);
            showMessage('error', `${str('Error loading calculation:')} ${error.message}`);
        }
    }, [showMessage, storeFileName, str]);

    return (
        <div>
            <Helmet>
                <title>Autolab - Calculator</title>
            </Helmet>
            <Stack wrap justifyContent='space-between'>
                <h3><Trans>Cost of repair calculation</Trans></h3>
                <Stack spacing={10}>
                    <Button appearance="primary" onClick={handleSave}>
                        <Trans>Save</Trans>
                    </Button>
                    <Button appearance="ghost" disabled={storeFileName == null} onClick={handleLoad}>
                        <Trans>Load from server</Trans>
                    </Button>
                    <Button appearance="link" color="red" size="xs" onClick={showReportIssueForm}>
                        <Trans>Report a problem</Trans>
                    </Button>
                </Stack>
            </Stack>
            <PanelGroup accordion defaultActiveKey={activeKey()} activeKey={activePanel} bordered onSelect={(key) => setActivePanel(parseInt(key))}>
                <Panel header={year === null ? str("Car") : `${make || ''} ${model || ''} ${year || ''} / ${carClass || ''} ${bodyType || ''}`} eventKey={1}>
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
                <Panel header={str("Color and paint type")} eventKey={2}>
                    <React.Suspense fallback={<Placeholder.Paragraph rows={8} />}>
                        <ColorPicker setColor={handleSetColor} selectedColor={color} />
                    </React.Suspense>
                    <VStack justifyContent='center' alignItems='center' style={{ margin: "40px" }}>
                        <SelectionInput name={str("Paint type")} values={Object.keys(paintTypesAndTranslations)} labels={paintTypesAndTranslations} selectedValue={paintType} onChange={handleSetPaintType} placeholder={str("Select paint type")} />
                    </VStack>
                    <Button onClick={() => setActivePanel(3)} disabled={paintType === null || color === null} color='green' appearance='primary'><Trans>Accept</Trans></Button>
                </Panel>
                <Panel header={str("Works")} eventKey={3}>
                    {bodyType !== null && (
                        <React.Suspense fallback={<Placeholder.Paragraph rows={8} />}>
                            <CarBodyPartsSelector selectedParts={selectedParts} onChange={handleSetSelectedParts} carClass={carClass} body={bodyType} />
                        </React.Suspense>
                    )}
                </Panel>
                <Panel header={str("Additional")} eventKey={4}>
                    <CurrentDateDisplay />
                </Panel>
            </PanelGroup>
        </div>
    );
};

export default CarPaintEstimator;