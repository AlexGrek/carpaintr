/* eslint-disable react/display-name */
import React, { useState, useEffect, useCallback } from 'react';
import { Button, VStack, Placeholder, PanelGroup, Panel, Divider, Input } from 'rsuite';
import { authFetch, authFetchYaml } from '../../utils/authFetch';
import SelectionInput from '../SelectionInput';
import { useSearchParams } from "react-router-dom"; // Import useSearchParams
import Trans from '../../localization/Trans';
import { useLocale, registerTranslations } from '../../localization/LocaleContext'; // Import registerTranslations
import { useGlobalCallbacks } from "../GlobalCallbacksContext"; // Ensure this context is stable
import './CarPaintEstimator.css';
import { capitalizeFirstLetter, handleOpenNewTab } from '../../utils/utils';


// Lazy load components for better initial bundle size
const CarBodyPartsSelector = React.lazy(() => import('./CarBodyPartsSelector'));

// NEW: Import the refactored PrintCalculationDrawer
import PrintCalculationDrawer from '../PrintCalculationDrawer';
import NotifyMessage from '../layout/NotifyMessage';
import LoadCalculationDrawer from './LoadCalculationDrawer';
import ConfirmationDialog from '../layout/ConfirmationDialog';
import ColorPicker from './ColorPicker';
import VehicleSelect from './VehicleSelect';
import TopPanel from './TopPanel';
import CurrentDateDisplay from './CurrentDateDisplay';
import './calc_translations';


// Main Parent component
const CarPaintEstimator = ({ setChanges }) => {
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
    const [n, setN] = useState(null);
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
        if (bodyType != null) {
            if (setChanges) {
                setChanges(true);
            }
            setActivePanel(2);
        }
    }, [bodyType, setChanges]);

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
        setN(`${str(capitalizeFirstLetter(type))} ${message}`);
    }, [str]);

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

    const currentCalculationData = {
        make, model, year, carClass, bodyType,
        licensePlate, VIN, notes, color, paintType, selectedParts
    };

    return (
        <div className="flex flex-col h-full"> {/* Use flexbox for layout */}
            <NotifyMessage text={n} />
            <TopPanel
                onNew={handleNew}
                saveEnabled={bodyType != null && year != null && carClass != null}
                onSave={handleSave}
                onLoad={() => setShowLoadDrawer(true)}
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