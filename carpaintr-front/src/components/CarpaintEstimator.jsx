/* eslint-disable react/display-name */
import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { SelectPicker, Button, DatePicker, VStack, Stack, Tabs, Placeholder, PanelGroup, Panel, Message, useToaster, Divider, Input, Modal, Drawer } from 'rsuite';
import { authFetch, authFetchYaml } from '../utils/authFetch';
import SelectionInput from './SelectionInput'; // Assuming SelectionInput is also optimized with React.memo
import { useNavigate } from "react-router-dom";
import Trans from '../localization/Trans';
import { useLocale, registerTranslations } from '../localization/LocaleContext'; // Import registerTranslations
import { useGlobalCallbacks } from "./GlobalCallbacksContext"; // Ensure this context is stable
import { useMediaQuery } from 'react-responsive';
import { FaSave, FaFolderOpen, FaPlus, FaPrint, FaTimes } from 'react-icons/fa'; // Importing icons

// Lazy load components for better initial bundle size
const CarBodyPartsSelector = React.lazy(() => import('./CarBodyPartsSelector'));
const ColorGrid = React.lazy(() => import('./ColorGrid')); // Used by ColorPicker

// --- New Components ---

// Confirmation Dialog Component
const ConfirmationDialog = React.memo(({ show, onClose, onConfirm, message }) => {
    const { str } = useLocale();
    return (
        <Modal open={show} onClose={onClose} size="xs">
            <Modal.Header>
                <Modal.Title><Trans>Confirmation</Trans></Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {message}
            </Modal.Body>
            <Modal.Footer>
                <Button onClick={onConfirm} appearance="primary">
                    <Trans>Confirm</Trans>
                </Button>
                <Button onClick={onClose} appearance="subtle">
                    <Trans>Cancel</Trans>
                </Button>
            </Modal.Footer>
        </Modal>
    );
});

// Load Calculation Drawer Component
const LoadCalculationDrawer = React.memo(({ show, onClose, onLoadCalculation }) => {
    const { str } = useLocale();
    const isMobile = useMediaQuery({ maxWidth: 767 });
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(false);
    const toaster = useToaster();

    const fetchFiles = useCallback(async () => {
        setLoading(true);
        try {
            const response = await authFetch('/api/v1/user/calculationstore/list');
            if (response.ok) {
                const data = await response.json();
                setFiles(data.files || []); // Assuming data.files is an array of filenames
            } else {
                const errorData = await response.json();
                toaster.push(
                    <Message type="error" closable duration={5000}>
                        {`${str('Failed to load file list:')} ${errorData.message || response.statusText}`}
                    </Message>,
                    { placement: 'topEnd' }
                );
                setFiles([]);
            }
        } catch (error) {
            console.error("Error fetching file list:", error);
            toaster.push(
                <Message type="error" closable duration={5000}>
                    {`${str('Error fetching file list:')} ${error.message}`}
                </Message>,
                { placement: 'topEnd' }
            );
            setFiles([]);
        } finally {
            setLoading(false);
        }
    }, [str, toaster]);

    useEffect(() => {
        if (show) {
            fetchFiles(); // Fetch files only when the drawer opens
        }
    }, [show, fetchFiles]);

    const handleFileSelect = useCallback((filename) => {
        onLoadCalculation(filename);
        onClose();
    }, [onLoadCalculation, onClose]);

    return (
        <Drawer
            size={isMobile ? 'full' : 'lg'}
            placement="top"
            open={show}
            onClose={onClose}
            style={{ overflowY: 'auto' }} // Make drawer content scrollable
        >
            <Drawer.Header>
                <Drawer.Title><Trans>Load Calculation</Trans></Drawer.Title>
                <Drawer.Actions>
                    <Button onClick={onClose} appearance="subtle"><FaTimes /></Button>
                </Drawer.Actions>
            </Drawer.Header>
            <Drawer.Body>
                {loading ? (
                    <Placeholder.Paragraph rows={5} />
                ) : files.length > 0 ? (
                    <VStack spacing={10} alignItems="flex-start">
                        {files.map((file, index) => (
                            <Button
                                key={index}
                                appearance="ghost"
                                onClick={() => handleFileSelect(file)}
                                block
                                style={{ justifyContent: 'flex-start' }}
                            >
                                {file}
                            </Button>
                        ))}
                    </VStack>
                ) : (
                    <Message type="info" showIcon>
                        <Trans>No saved calculations found.</Trans>
                    </Message>
                )}
            </Drawer.Body>
        </Drawer>
    );
});

// Dummy Print Preview Component
const PrintPreview = React.memo(({ calculationData }) => {
    const { str } = useLocale();

    if (!calculationData) {
        return <Message type="info" showIcon><Trans>No data to preview.</Trans></Message>;
    }

    return (
        <div className="p-4">
            <h4 className="text-xl font-bold mb-4"><Trans>Calculation Summary</Trans></h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <p><strong><Trans>Make</Trans>:</strong> {calculationData.make || str('N/A')}</p>
                    <p><strong><Trans>Model</Trans>:</strong> {calculationData.model || str('N/A')}</p>
                    <p><strong><Trans>Year</Trans>:</strong> {calculationData.year || str('N/A')}</p>
                    <p><strong><Trans>Car Class</Trans>:</strong> {calculationData.carClass || str('N/A')}</p>
                    <p><strong><Trans>Body Type</Trans>:</strong> {calculationData.bodyType || str('N/A')}</p>
                    <p><strong><Trans>Color</Trans>:</strong> {calculationData.color || str('N/A')}</p>
                    <p><strong><Trans>Paint type</Trans>:</strong> {calculationData.paintType || str('N/A')}</p>
                </div>
                <div>
                    <p><strong><Trans>License plate</Trans>:</strong> {calculationData.licensePlate || str('N/A')}</p>
                    <p><strong><Trans>VIN</Trans>:</strong> {calculationData.VIN || str('N/A')}</p>
                    <p><strong><Trans>Notes</Trans>:</strong> {calculationData.notes || str('N/A')}</p>
                </div>
            </div>
            <h5 className="text-lg font-semibold mt-6 mb-2"><Trans>Selected Body Parts</Trans></h5>
            {calculationData.selectedParts && calculationData.selectedParts.length > 0 ? (
                <ul className="list-disc list-inside">
                    {calculationData.selectedParts.map((part, index) => (
                        <li key={index}>{part}</li>
                    ))}
                </ul>
            ) : (
                <p><Trans>No body parts selected.</Trans></p>
            )}
            {/* Add more details as needed */}
        </div>
    );
});

// Print Preview Drawer Component
const PrintPreviewDrawer = React.memo(({ show, onClose, calculationData }) => {
    const { str } = useLocale();
    const isMobile = useMediaQuery({ maxWidth: 767 });

    return (
        <Drawer
            size={isMobile ? 'full' : 'lg'}
            placement="top"
            open={show}
            onClose={onClose}
            style={{ overflowY: 'auto' }} // Make drawer content scrollable
        >
            <Drawer.Header>
                <Drawer.Title><Trans>Print Preview</Trans></Drawer.Title>
                <Drawer.Actions>
                    <Button onClick={onClose} appearance="subtle"><FaTimes /></Button>
                </Drawer.Actions>
            </Drawer.Header>
            <Drawer.Body>
                <React.Suspense fallback={<Placeholder.Paragraph rows={10} />}>
                    <PrintPreview calculationData={calculationData} />
                </React.Suspense>
            </Drawer.Body>
            <Drawer.Footer>
                <Button appearance="primary" onClick={() => window.print()}><Trans>Print</Trans></Button>
                <Button appearance="subtle" onClick={onClose}><Trans>Close</Trans></Button>
            </Drawer.Footer>
        </Drawer>
    );
});


// Top Panel Subcomponent
const TopPanel = React.memo(({ onNew, onSave, onLoad, onPrint, showReportIssueForm }) => {
    const { str } = useLocale();
    const isMobile = useMediaQuery({ maxWidth: 767 }); // Define breakpoint for mobile

    return (
        <Stack
            wrap
            justifyContent={isMobile ? 'center' : 'space-between'} // Center on mobile, space-between on desktop
            alignItems="center"
            className="sticky top-0 bg-white p-4 z-10 shadow-md rounded-b-lg" // Sticky position, background, padding, shadow, rounded corners
            spacing={isMobile ? 5 : 10} // Smaller spacing on mobile
        >
            {!isMobile && <h3 className="text-2xl font-semibold"><Trans>Cost of repair calculation</Trans></h3>}
            <Stack spacing={isMobile ? 5 : 10} justifyContent="center" alignItems="center"> {/* Center buttons horizontally */}
                <Button appearance="primary" onClick={onNew} className="rounded-md">
                    <FaPlus className={isMobile ? "text-lg" : "mr-2"} />
                    {!isMobile && <Trans>New</Trans>}
                </Button>
                <Button appearance="primary" onClick={onSave} className="rounded-md">
                    <FaSave className={isMobile ? "text-lg" : "mr-2"} />
                    {!isMobile && <Trans>Save</Trans>}
                </Button>
                <Button appearance="ghost" onClick={onLoad} className="rounded-md">
                    <FaFolderOpen className={isMobile ? "text-lg" : "mr-2"} />
                    {!isMobile && <Trans>Load</Trans>}
                </Button>
                <Button appearance="ghost" onClick={onPrint} className="rounded-md">
                    <FaPrint className={isMobile ? "text-lg" : "mr-2"} />
                    {!isMobile && <Trans>Print</Trans>}
                </Button>
                {!isMobile && ( // Show report button only on desktop for now to save space
                    <Button appearance="link" color="red" size="xs" onClick={showReportIssueForm} className="rounded-md">
                        <Trans>Report a problem</Trans>
                    </Button>
                )}
            </Stack>
        </Stack>
    );
});


// --- Existing Components (modified for lazy loading or minor adjustments) ---

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
    "Paint type": "Тип фарби",
    "New": "Новий",
    "Print": "Друк",
    "Confirmation": "Підтвердження",
    "Cancel": "Скасувати",
    "Confirm": "Підтвердити",
    "Reset calculation confirmation": "Ви впевнені, що хочете почати новий розрахунок? Всі незбережені дані будуть втрачені.",
    "Load Calculation": "Завантажити розрахунок",
    "Failed to load file list:": "Не вдалося завантажити список файлів:",
    "Error fetching file list:": "Помилка при отриманні списку файлів:",
    "Print Preview": "Попередній перегляд друку",
    "Close": "Закрити",
    "Calculation Summary": "Підсумок розрахунку",
    "N/A": "Н/Д",
    "No data to preview.": "Немає даних для попереднього перегляду.",
    "No body parts selected.": "Не вибрано жодних частин кузова."
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
    const [licensePlate, setLicensePlate] = useState("");
    const [VIN, setVIN] = useState("");
    const [notes, setNotes] = useState("");
    const [color, setColor] = useState(null);
    const [selectedParts, setSelectedParts] = useState([]);
    const [activePanel, setActivePanel] = useState(1);
    const [paintType, setPaintType] = useState(null);
    const [storeFileName, setStoreFileName] = useState(null);
    const toaster = useToaster();
    const { str } = useLocale();

    // State for drawers and dialogs
    const [showNewConfirmation, setShowNewConfirmation] = useState(false);
    const [showLoadDrawer, setShowLoadDrawer] = useState(false);
    const [showPrintDrawer, setShowPrintDrawer] = useState(false);

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
    const handleSetVIN = useCallback((val) => setVIN(val), []);
    const handleSetLicensePlate = useCallback((val) => setLicensePlate(val), []);
    const handleSetNotes = useCallback((val) => setNotes(val), []);
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

    // Function to reset all state to initial values
    const resetCalculationState = useCallback(() => {
        setMake(null);
        setModel(null);
        setYear(null);
        setCarClass(null);
        setBodyType(null);
        setLicensePlate("");
        setVIN("");
        setNotes("");
        setColor(null);
        setSelectedParts([]);
        setActivePanel(1);
        setPaintType(null);
        setStoreFileName(null);
    }, []);

    const handleNew = useCallback(() => {
        setShowNewConfirmation(true);
    }, []);

    const confirmNewCalculation = useCallback(() => {
        resetCalculationState();
        setShowNewConfirmation(false);
        showMessage('info', str('New calculation started.'));
    }, [resetCalculationState, showMessage, str]);

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
            vin: VIN,
            notes: notes,
            license_plate: licensePlate === '' ? null : licensePlate
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
    }, [make, model, year, bodyType, carClass, color, paintType, selectedParts, showMessage, storeFileName, str, VIN, notes, licensePlate]);

    const handleLoad = useCallback(async (filename) => {
        try {
            const response = await authFetch(`/api/v1/user/calculationstore?filename=${filename}`);
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
                    setVIN(data.vin || "");
                    setNotes(data.notes || "");
                    setLicensePlate(data.license_plate || "");
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
    }, [showMessage, str]);

    const handlePrint = useCallback(() => {
        setShowPrintDrawer(true);
    }, []);

    // Gather all calculation data for printing
    const currentCalculationData = {
        make, model, year, carClass, bodyType,
        licensePlate, VIN, notes, color, paintType, selectedParts
    };

    return (
        <div className="flex flex-col h-full"> {/* Use flexbox for layout */}
            <TopPanel
                onNew={handleNew}
                onSave={handleSave}
                onLoad={() => setShowLoadDrawer(true)} // Open load drawer
                onPrint={handlePrint}
                showReportIssueForm={showReportIssueForm}
            />

            <div className="flex-grow overflow-y-auto p-4"> {/* Main content area, scrollable */}
                <PanelGroup accordion defaultActiveKey={activeKey()} activeKey={activePanel} bordered onSelect={(key) => setActivePanel(parseInt(key))}>
                    <Panel className='fade-in-simple' header={year === null ? str("Car") : `${make || ''} ${model || ''} ${year || ''} / ${carClass || ''} ${bodyType || ''}`} eventKey={1}>
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
                        <Divider><Trans>Additional info</Trans></Divider>
                        <Input value={licensePlate} onChange={handleSetLicensePlate} placeholder={str('License plate (optional)')}></Input>
                        <Input value={VIN} onChange={handleSetVIN} placeholder={str('VIN (optional)')}></Input>
                        <Input as='textarea' value={notes} onChange={handleSetNotes} placeholder={str('Notes')}></Input>
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

            {/* Confirmation Dialog */}
            <ConfirmationDialog
                show={showNewConfirmation}
                onClose={() => setShowNewConfirmation(false)}
                onConfirm={confirmNewCalculation}
                message={str("Reset calculation confirmation")}
            />

            {/* Load Calculation Drawer */}
            <LoadCalculationDrawer
                show={showLoadDrawer}
                onClose={() => setShowLoadDrawer(false)}
                onLoadCalculation={handleLoad}
            />

            {/* Print Preview Drawer */}
            <PrintPreviewDrawer
                show={showPrintDrawer}
                onClose={() => setShowPrintDrawer(false)}
                calculationData={currentCalculationData}
            />
        </div>
    );
};

export default CarPaintEstimator;
