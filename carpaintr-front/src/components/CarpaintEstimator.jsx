/* eslint-disable react/display-name */
import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { SelectPicker, Button, DatePicker, VStack, Stack, Tabs, Placeholder, PanelGroup, Panel, Message, useToaster, Divider, Input, Modal, Drawer, Text, HStack, IconButton } from 'rsuite';
import { authFetch, authFetchYaml } from '../utils/authFetch';
import SelectionInput from './SelectionInput'; // Assuming SelectionInput is also optimized with React.memo
import { useNavigate, useSearchParams } from "react-router-dom"; // Import useSearchParams
import Trans from '../localization/Trans';
import { useLocale, registerTranslations } from '../localization/LocaleContext'; // Import registerTranslations
import { useGlobalCallbacks } from "./GlobalCallbacksContext"; // Ensure this context is stable
import { useMediaQuery } from 'react-responsive';
import './CarPaintEstimator.css';
import { capitalizeFirstLetter, handleOpenNewTab } from '../utils/utils';
import PlusRoundIcon from '@rsuite/icons/PlusRound';
import FileDownloadIcon from '@rsuite/icons/FileDownload';
import TableIcon from '@rsuite/icons/Table';
import SaveIcon from '@rsuite/icons/Save';
import DocPassIcon from '@rsuite/icons/DocPass';
import RemindOutlineIcon from '@rsuite/icons/RemindOutline';

// Lazy load components for better initial bundle size
const CarBodyPartsSelector = React.lazy(() => import('./CarBodyPartsSelector'));
const ColorGrid = React.lazy(() => import('./ColorGrid')); // Used by ColorPicker

// NEW: Import the refactored PrintCalculationDrawer
import PrintCalculationDrawer from './PrintCalculationDrawer';

// --- New Components (moved/refactored) ---

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

// Helper function to format time ago
const formatTimeAgo = (dateString, str) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.round(diffMs / (1000 * 60));
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 60) {
        return `${diffMinutes}m ago`;
    } else if (diffHours < 24) {
        return `${diffHours}h ago`;
    } else if (diffDays < 7) {
        return `${diffDays}d ago`;
    } else {
        // Fallback to full date for older than a week
        return date.toLocaleDateString(str('locale_code') || 'en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    }
};

// Load Calculation Drawer Component
const LoadCalculationDrawer = React.memo(({ show, onClose }) => {
    const { str } = useLocale();
    const isMobile = useMediaQuery({ maxWidth: 767 });
    const [files24h, setFiles24h] = useState([]);
    const [files1w, setFiles1w] = useState([]);
    const [filesOlder, setFilesOlder] = useState([]);
    const [loading, setLoading] = useState(false);
    const toaster = useToaster();
    const navigate = useNavigate();

    const fetchFiles = useCallback(async () => {
        setLoading(true);
        try {
            const response = await authFetch('/api/v1/user/calculationstore/list');
            if (response.ok) {
                const data = await response.json();
                setFiles24h(data.modified_last_24h || []);
                setFiles1w(data.modified_1w_excl_24h || []);
                setFilesOlder(data.older_than_1w || []);
            } else {
                const errorData = await response.json();
                toaster.push(
                    <Message type="error" closable>
                        {`${str('Failed to load file list:')} ${errorData.message || response.statusText}`}
                    </Message>,
                    { placement: 'topEnd' }
                );
                setFiles24h([]);
                setFiles1w([]);
                setFilesOlder([]);
            }
        } catch (error) {
            console.error("Error fetching file list:", error);
            toaster.push(
                <Message type="error" closable>
                    {`${str('Error fetching file list:')} ${error.message}`}
                </Message>,
                { placement: 'topEnd' }
            );
            setFiles24h([]);
            setFiles1w([]);
            setFilesOlder([]);
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
        navigate(`/calc?id=${filename}`); // Navigate to /calc?id={filename}
        onClose();
    }, [navigate, onClose]);

    const renderFileList = useCallback((files, groupTitle) => (
        <VStack spacing={10} alignItems="flex-start" className="w-full">
            <h5 className="font-semibold text-lg mb-2">{groupTitle}</h5>
            {files.length > 0 ? (
                <VStack spacing={5} alignItems="flex-start" className="calc-file-load-stack">
                    {files.map((file, index) => (
                        <div key={index}
                            className='calc-file-load-entry'
                            onClick={() => handleFileSelect(file.name)}
                            style={{ justifyContent: 'space-between', padding: '8px 12px' }}
                        >
                            <HStack width="100%" justifyContent='space-between'>
                                <p className="calc-file-load-entry-name"><DocPassIcon style={{ marginRight: "6pt", fontSize: "larger" }} />{capitalizeFirstLetter(file.name.split('_').slice(0, -1).join(' '))}</p>
                                <p className="calc-file-load-entry-date"><Text as="sub">{formatTimeAgo(file.modified, str)}</Text></p>
                            </HStack>
                        </div>
                    ))}
                </VStack>
            ) : (
                <Message type="info" showIcon className="w-full">
                    <Trans>No files in this category.</Trans>
                </Message>
            )}
        </VStack>
    ), [handleFileSelect, str]);

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
                    <Button onClick={onClose} appearance="subtle"></Button>
                </Drawer.Actions>
            </Drawer.Header>
            <Drawer.Body>
                {loading ? (
                    <Placeholder.Paragraph rows={5} />
                ) : (
                    <Stack
                        wrap={isMobile} // Wrap on mobile to stack columns
                        justifyContent={isMobile ? 'flex-start' : 'space-around'}
                        alignItems={isMobile ? 'flex-start' : 'flex-start'}
                        spacing={isMobile ? 20 : 30}
                        className="w-full"
                    >
                        {renderFileList(files24h, str('Modified last 24h'))}
                        {renderFileList(files1w, str('Modified 1 week excl 24h'))}
                        {renderFileList(filesOlder, str('Older than 1 week'))}
                    </Stack>
                )}
            </Drawer.Body>
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
            className="calc-buttons-panel-stack sticky top-0 bg-white p-4 z-10 shadow-md rounded-b-lg" // Sticky position, background, padding, shadow, rounded corners
            spacing={isMobile ? 5 : 10} // Smaller spacing on mobile
        >
            {!isMobile && <h3 className="text-2xl font-semibold"><Trans>Cost of repair calculation</Trans></h3>}
            <Stack spacing={isMobile ? 5 : 10} justifyContent="center" alignItems="center"> {/* Center buttons horizontally */}
                <IconButton icon={<PlusRoundIcon />} appearance="primary" onClick={onNew} className="rounded-md">
                    {!isMobile && <Trans>New</Trans>}
                </IconButton>
                <IconButton icon={<SaveIcon />} onClick={onSave} className="rounded-md">
                    {!isMobile && <Trans>Save</Trans>}
                </IconButton>
                <IconButton icon={<FileDownloadIcon />} onClick={onLoad} className="rounded-md">
                    {!isMobile && <Trans>Recents</Trans>}
                </IconButton>
                <IconButton icon={<TableIcon />} onClick={onPrint} className="rounded-md">
                    {!isMobile && <Trans>Print</Trans>}
                </IconButton>
                {!isMobile && ( // Show report button only on desktop for now to save space
                    <IconButton icon={<RemindOutlineIcon/>} appearance="link" color="red" size="xs" onClick={showReportIssueForm} className="rounded-md">
                        <Trans>Report a problem</Trans>
                    </IconButton>
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
    "Select paint type": "Оберіть тип фарби",
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
    "Print Preview": "Попередній перегляд друку", // This translation is still here for historical reasons or if it's used elsewhere for generic "preview"
    "Close": "Закрити",
    "Calculation Summary": "Підсумок розрахунку",
    "N/A": "Н/Д",
    "No data to preview.": "Немає даних для попереднього перегляду.",
    "No body parts selected.": "Не вибрано жодних частин кузова.",
    "Modified last 24h": "Змінено за останні 24 години",
    "Modified 1 week excl 24h": "Змінено за останній тиждень (крім 24 год)",
    "Older than 1 week": "Старіші за 1 тиждень",
    "No files in this category.": "Немає файлів у цій категорії.",
    "locale_code": "uk-UA",
    "License plate (optional)": "Держ. номер (необов'язково)",
    "VIN (optional)": "VIN (необов'язково)",
    "Notes": "Примітки",
    "Additional info": "Додатково",
    "Make": "Марка",
    "Model": "Модель",
    "Body Type": "Тип кузова",
    "Recents": "Збережені",

    "sedan": "Седан",
    "hatchback 3 doors": "Хетчбек 3-дверний",
    "hatchback 5 doors": "Хетчбек 5-дверний",
    "suv 3 doors": "Позашляховик 3-дверний",
    "suv 5 doors": "Позашляховик 5-дверний",
    "pickup": "Пікап",
    "coupe": "Купе",
    "wagon": "Універсал",
    "liftback": "Ліфтбек",
    "cabriolet": "Кабріолет",

    // NEW TRANSLATIONS for Print and Document Generation
    "Print and Document Generation": "Друк та генерація документів",
    "Document Generation": "Генерація документів",
    "Custom Template Content (HTML/Liquid)": "Власний вміст шаблону (HTML/Liquid)",
    "Enter custom template content here (e.g., HTML with placeholders)": "Введіть власний вміст шаблону тут (наприклад, HTML з плейсхолдерами)",
    "Order Number": "Номер замовлення",
    "Enter order number": "Введіть номер замовлення",
    "Order Notes": "Примітки до замовлення",
    "Enter order notes": "Введіть примітки до замовлення",
    "Generate Preview (HTML)": "Сформувати попередній перегляд (HTML)",
    "Download PDF": "Завантажити PDF",
    "HTML preview generated successfully!": "HTML попередній перегляд успішно згенеровано!",
    "PDF downloaded successfully!": "PDF успішно завантажено!",
    "Generate a preview to see it here.": "Сформуйте попередній перегляд, щоб побачити його тут.",
    "Failed to generate preview:": "Не вдалося згенерувати попередній перегляд:",
    "Error generating preview:": "Помилка при генерації попереднього перегляду:",
    "Failed to download PDF:": "Не вдалося завантажити PDF:",
    "Error downloading PDF:": "Помилка при завантаженні PDF:",
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
    }, []);

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
const VehicleSelect = React.memo(({ selectedBodyType, setBodyType, selectedMake, selectedModel, year, setMake, setModel, setYear, carclass, setCarClass, isFromLoading }) => {
    const [makes, setMakes] = useState([]);
    const [models, setModels] = useState({});
    const [bodyTypes, setBodyTypes] = useState([]);
    const { str, labels } = useLocale();
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
        if (!isFromLoading) {
            setModel(null);
            setBodyType(null);
        }
        
        setModels({});
        
        if (selectedMake === null) {
            return;
        }
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

    const modelOptions = Object.keys(models);

    return (
        <div>
            <Tabs defaultActiveKey="1" appearance="pills" style={{ margin: "0 auto" }}>
                <Tabs.Tab eventKey="1" title={str("Models")} style={{ width: "100%" }}>
                    <SelectionInput name={str("Make")} values={makes} labelFunction={capitalizeFirstLetter} selectedValue={selectedMake} onChange={handleMakeSelect} placeholder={str("Select Make")} />
                    {selectedMake !== null && <SelectionInput name={str("Model")} selectedValue={selectedModel} values={modelOptions} onChange={handleModelSelect} placeholder={str("Select Model")} />}
                    {selectedModel !== null && <SelectionInput name={str("Body Type")} labelFunction={str} selectedValue={selectedBodyType} values={labels(bodyTypes)} onChange={setBodyType} placeholder={str("Select Body Type")} />}
                </Tabs.Tab>
                <Tabs.Tab eventKey="2" title={str("Type/Class")}>
                    <SelectPicker
                        data={CAR_CLASS_OPTIONS}
                        onSelect={setCarClass}
                        value={carclass}
                        placeholder={str("CLASS")}
                    />
                    <SelectPicker
                        data={CAR_BODY_TYPES_OPTIONS.map(opt => ({ label: str(opt.label), value: opt.value }))} // Apply translation here
                        onSelect={setBodyType}
                        value={selectedBodyType}
                        placeholder={str("BODY TYPE")}
                    />
                </Tabs.Tab>
            </Tabs>
            <SelectPicker
                disabled={!(selectedModel !== null || (carclass !== null && selectedBodyType !== null))}
                data={[...Array(30)].map((_, i) => {
                    let y = `${2024 - i}`;
                    return { label: y, value: y };
                })}
                onSelect={setYear}
                value={year}
                placeholder={str("Year of manufacture")}
                searchable={false}
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
    const [searchParams] = useSearchParams(); // Get search params from URL
    const [partsVisual, setPartsVisual] = useState({});

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
        if (bodyType != null)
            setActivePanel(2);
    }, [bodyType]);

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
            year: year,
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
            // Add .json extension as specified
            const response = await authFetch(`/api/v1/user/calculationstore?filename=${filename}.json`);
            if (response.ok) {
                const data = await response.json();
                if (data) {
                    setMake(data.model?.brand || null);
                    setModel(data.model?.model || null);
                    setYear(data.year || null);
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

    // Effect to load calculation from URL parameter on initial render
    useEffect(() => {
        const idFromUrl = searchParams.get('id');
        if (idFromUrl) {
            handleLoad(idFromUrl);
        }
    }, [searchParams, handleLoad]); // Depend on searchParams and handleLoad

    useEffect(() => {
        const fetchData = async () => {
            try {
                let data = await authFetchYaml('/api/v1/user/global/parts_visual.yaml');
                setPartsVisual(data);
            } catch (error) {
                console.error("Failed to fetch parts_visual:", error);
            }
        };
        fetchData();
    }, [])

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
                showReportIssueForm={() => handleOpenNewTab("/report")}
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
                            year={year}
                            isFromLoading={storeFileName != null}
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
                                <CarBodyPartsSelector partsVisual={partsVisual} selectedParts={selectedParts} onChange={handleSetSelectedParts} carClass={carClass} body={bodyType} />
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
            />

            {/* Print Calculation Drawer (newly integrated) */}
            <PrintCalculationDrawer
                show={showPrintDrawer}
                onClose={() => setShowPrintDrawer(false)}
                calculationData={currentCalculationData}
            />
        </div>
    );
};

export default CarPaintEstimator;