
import { useCallback, useEffect, useState, useRef } from 'react';
import PropTypes from 'prop-types';
import { Divider, Panel, Message, Drawer, Modal, Button } from 'rsuite';
import { useMediaQuery } from 'react-responsive';
import { Check, X } from 'lucide-react';
import { useLocale, registerTranslations } from '../../localization/LocaleContext';
import { authFetch, getOrFetchCompanyInfo } from '../../utils/authFetch';
import { make_sandbox_extensions, verify_processor } from '../../calc/processor_evaluator';
import CarDiagram, { buildCarSubcomponentsFromT2 } from './diagram/CarDiagram';
import MenuPickerV2 from '../layout/MenuPickerV2';

registerTranslations("en", {
    "Selected Parts": "Selected Parts",
    "Name": "Name",
    "Zone": "Zone",
    "Group": "Group",
    "Action": "Action",
    "Remove": "Remove",
    "Details": "Details",
    "Part Details": "Part Details",
    "Close": "Close",
    "No additional information available": "No additional information available",
    "Actions": "Actions",
    "Select actions for this part": "Select actions for this part",
    "assemble": "assemble",
    "twist": "twist",
    "paint": "paint",
    "replace": "replace",
    "mount": "mount",
    "repair": "repair",
    "Confirm Deletion": "Confirm Deletion",
    "Are you sure you want to remove this part?": "Are you sure you want to remove this part?",
    "Cancel": "Cancel",
    "Raw Data": "Raw Data",
    "Content for action will appear here": "Content for {action} action will appear here",
    "Damage Level": "Damage Level",
    "Original Part": "Original Part",
    "Replace Part": "Replace Part",
    "Save": "Save",
    "toning": "toning",
});

registerTranslations("ua", {
    "Selected Parts": "Обрані деталі",
    "Name": "Назва",
    "Zone": "Зона",
    "Group": "Група",
    "Action": "Дія",
    "Remove": "Видалити",
    "Details": "Деталі",
    "Part Details": "Деталі деталі",
    "Close": "Закрити",
    "No additional information available": "Немає додаткової інформації",
    "Actions": "Дії",
    "Select actions for this part": "Виберіть дії для цієї деталі",
    "assemble": "зібрати",
    "twist": "вигнути",
    "paint": "фарбувати",
    "replace": "замінити",
    "mount": "змонтувати",
    "repair": "відремонтувати",
    "Confirm Deletion": "Підтвердити видалення",
    "Are you sure you want to remove this part?": "Ви впевнені, що хочете видалити цю деталь?",
    "Cancel": "Скасувати",
    "Raw Data": "Необроблені дані",
    "Content for action will appear here": "Зміст для дії {action} з'явиться тут",
    "Damage Level": "Рівень пошкодження",
    "Original Part": "Оригінальна деталь",
    "Replace Part": "Замінити деталь",
    "Save": "Зберегти",
    "toning": "тонування",
});

const CarBodyMain = ({
    partsVisual,
    selectedParts,
    onChange,
    carClass,
    body,
    calculations,
    setCalculations,
    className,
    style
}) => {
    const isMobile = useMediaQuery({ maxWidth: 767 });
    const { str } = useLocale();
    const [company, setCompany] = useState(null);
    const [showTechData, setShowTechData] = useState(false);

    // State declarations - must come before callbacks that use them
    const [errors, setErrors] = useState([]);
    const [availableParts, setAvailableParts] = useState([]);
    const [availablePartsT2, setAvailablePartsT2] = useState([]);
    const [processors, setProcessors] = useState([]);
    const [selectedItems, setSelectedItems] = useState([]);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [drawerPartDetails, setDrawerPartDetails] = useState(null);
    const [editedPart, setEditedPart] = useState(null); // Local state for drawer edits
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null);

    // Ref to prevent infinite loop when syncing state
    const isInternalUpdate = useRef(false);

    // Ref to track current selectedItems for comparison
    const selectedItemsRef = useRef(selectedItems);

    // Update ref when selectedItems changes
    useEffect(() => {
        selectedItemsRef.current = selectedItems;
    }, [selectedItems]);

    // Helper to deep compare arrays of objects
    const arraysEqual = useCallback((a, b) => {
        if (a === b) return true;
        if (!a || !b) return false;
        if (a.length !== b.length) return false;

        // Quick check: compare stringified versions
        return JSON.stringify(a) === JSON.stringify(b);
    }, []);

    // Handler for selecting a new part from the dropdown
    const handlePartSelect = useCallback(
        (partName) => {
            // Check if the part is already in selectedParts (e.g., if re-opening for edit)
            const existingPart = selectedParts.find((p) => p.name === partName);

            const newPart = existingPart
                ? { ...existingPart } // If existing, create a shallow copy to modify
                : {
                    action: null,
                    replace: false,
                    original: true,
                    damageLevel: 0,
                    name: partName,
                    // grid: generateInitialGrid(mapVisual(partName ? partName : "")),
                    outsideRepairZone: null,
                    // tableData: getOrFetchTableData(partName),
                };

            // setDrawerCurrentPart(newPart);
            // setIsDrawerOpen(true);
        },
        [],
    );

    const handleDiagramSelect = useCallback((item) => {
        // Toggle item in selectedItems array
        setSelectedItems(prev => {
            const existingIndex = prev.findIndex(i => i.name === item.name);
            if (existingIndex >= 0) {
                // Remove item
                return prev.filter((_, idx) => idx !== existingIndex);
            } else {
                // Add item with null selectedAction
                return [...prev, { ...item, selectedAction: null }];
            }
        });
    }, []);

    const handleShowDetails = useCallback((item) => {
        // Find the item in selectedItems to get the current data
        const selectedItem = selectedItems.find(i => i.name === item.name);
        const partToEdit = selectedItem || item;

        setDrawerPartDetails(partToEdit);
        // Initialize local edit state with current values
        setEditedPart({
            name: partToEdit.name,
            action: partToEdit.selectedAction || partToEdit.action || null,
            damageLevel: partToEdit.damageLevel ?? 0,
            original: partToEdit.original ?? true,
            replace: partToEdit.replace ?? false,
        });
        setDrawerOpen(true);
    }, [selectedItems]);

    const handleDrawerSave = useCallback(() => {
        if (editedPart) {
            // Update selectedItems with edited data
            setSelectedItems(prev => prev.map(item => {
                if (item.name === editedPart.name) {
                    return {
                        ...item,
                        selectedAction: editedPart.action,
                        action: editedPart.action,
                        damageLevel: editedPart.damageLevel,
                        original: editedPart.original,
                        replace: editedPart.replace,
                    };
                }
                return item;
            }));
        }
        setDrawerOpen(false);
        setEditedPart(null);
    }, [editedPart]);

    const handleDrawerCancel = useCallback(() => {
        setDrawerOpen(false);
        setEditedPart(null);
    }, []);

    const handleRequestDelete = useCallback((item) => {
        setItemToDelete(item);
        setDeleteConfirmOpen(true);
    }, []);

    const handleConfirmDelete = useCallback(() => {
        if (itemToDelete) {
            handleDiagramSelect(itemToDelete);
        }
        setDeleteConfirmOpen(false);
        setItemToDelete(null);
    }, [itemToDelete, handleDiagramSelect]);

    // No longer needed - drawer uses local state now
    // useEffect(() => {
    //     if (drawerOpen && drawerPartDetails) {
    //         const updatedItem = selectedItems.find(i => i.name === drawerPartDetails.name);
    //         if (updatedItem) {
    //             setDrawerPartDetails(updatedItem);
    //         }
    //     }
    // }, [selectedItems, drawerOpen, drawerPartDetails]);

    // Sync selectedParts prop → selectedItems state (parent controls initial state)
    useEffect(() => {
        if (selectedParts && Array.isArray(selectedParts)) {
            // Convert selectedParts format to selectedItems format
            const converted = selectedParts.map(part => ({
                name: part.name,
                zone: part.zone || null,
                group: part.group || null,
                actions: part.actions || [],
                selectedAction: part.action || null,
                // Preserve any additional fields from parent
                ...part
            }));

            // Only update if actually different (prevents infinite loops)
            // Use ref to get current value without adding to dependencies
            if (!arraysEqual(converted, selectedItemsRef.current)) {
                console.log('[CarBodyMain] Syncing FROM parent:', { selectedParts, converted, currentItems: selectedItemsRef.current });
                // Mark as external update to prevent calling onChange
                isInternalUpdate.current = true;
                setSelectedItems(converted);

                // Reset flag after state update completes
                setTimeout(() => {
                    isInternalUpdate.current = false;
                    console.log('[CarBodyMain] Reset isInternalUpdate flag');
                }, 0);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedParts]); // Only run when parent's selectedParts changes, not when internal selectedItems changes

    // Sync selectedItems state → onChange callback (notify parent of changes)
    // Store previous value to detect actual changes
    const prevSelectedItemsRef = useRef();
    useEffect(() => {
        // Only call onChange if this is a user-initiated change (not from prop sync)
        // AND the value has actually changed
        const isUserChange = !isInternalUpdate.current;
        const hasChanged = !arraysEqual(selectedItems, prevSelectedItemsRef.current);

        console.log('[CarBodyMain] Sync TO parent check:', {
            isUserChange,
            hasChanged,
            selectedItems,
            prev: prevSelectedItemsRef.current
        });

        if (isUserChange && onChange && hasChanged) {
            console.log('[CarBodyMain] Calling onChange with:', selectedItems);
            prevSelectedItemsRef.current = selectedItems;
            onChange(selectedItems);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedItems]); // onChange is stable (memoized in parent), don't need it in deps

    // Unified error handler
    const handleError = useCallback((context, error) => {
        const errorMessage = error?.message || error?.toString() || 'Unknown error';
        const errorEntry = {
            timestamp: new Date().toISOString(),
            context,
            message: errorMessage,
            details: error
        };

        console.error(`[${context}]`, error);
        setErrors(prev => [...prev, errorEntry]);
    }, []);

    // Unified fetch handler with logging
    const fetchData = useCallback(async (url, context, onSuccess) => {
        console.log(`[${context}] Fetching from: ${url}`);

        try {
            const response = await authFetch(url);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const contentType = response.headers.get('content-type');
            let data;

            if (contentType?.includes('application/json')) {
                data = await response.json();
            } else {
                data = await response.text();
            }

            console.log(`[${context}] Success:`, data);
            onSuccess(data);

        } catch (error) {
            handleError(context, error);
        }
    }, [handleError]);

    // Effect to fetch company info and car parts
    useEffect(() => {
        const updateCompanyInfo = async () => {
            try {
                const info = await getOrFetchCompanyInfo();
                if (info != null) {
                    console.log('[Company Info] Loaded:', info);
                    setCompany(info);
                }
            } catch (error) {
                handleError('Company Info', error);
            }
        };

        updateCompanyInfo();

        if (carClass == null || body == null) {
            console.log('[Init] Waiting for carClass and body to be set');
            return;
        }

        // Reset state
        setAvailableParts([]);
        setAvailablePartsT2([]);
        setProcessors([]);
        setErrors([]);

        // Fetch processors bundle
        fetchData(
            '/api/v1/user/processors_bundle',
            'Processors Bundle',
            (code) => {
                try {
                    const sandbox = { exports: {}, ...make_sandbox_extensions() };
                    new Function("exports", code)(sandbox.exports);
                    const plugins = sandbox.exports.default.map((p) => verify_processor(p));
                    console.log('[Processors Bundle] Processed plugins:', plugins);
                    setProcessors(plugins);
                } catch (error) {
                    handleError('Processors Bundle Processing', error);
                }
            }
        );

        // Fetch car parts (T1)
        fetchData(
            `/api/v1/user/carparts/${carClass}/${body}`,
            'Car Parts T1',
            (data) => setAvailableParts(data)
        );

        // Fetch car parts (T2)
        fetchData(
            `/api/v1/user/carparts_t2/${carClass}/${body}`,
            'Car Parts T2',
            (data) => setAvailablePartsT2(data)
        );

    }, [body, carClass, handleError, fetchData]);

    return (
        <Panel
            header={`Car Body: ${body || 'Unknown'} (Class ${carClass || 'N/A'})`}
            className={className}
            style={{
                ...style,
                position: 'relative',
                maxWidth: '900px',
                margin: '0 auto',
                width: '100%'
            }}
        >
            {/* Settings cog button */}
            <button
                onClick={() => setShowTechData(!showTechData)}
                style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    opacity: 0.3,
                    transition: 'opacity 0.2s',
                    padding: '5px',
                    fontSize: '18px',
                    color: '#666'
                }}
                onMouseEnter={(e) => e.target.style.opacity = '0.7'}
                onMouseLeave={(e) => e.target.style.opacity = '0.3'}
                title="Toggle technical data"
            >
                ⚙️
            </button>

            <div style={{ padding: '4pt', textAlign: 'center', width: '100%' }}>
                {!showTechData ? (
                    <>
                        <CarDiagram
                            selectedItems={selectedItems}
                            onSelect={handleDiagramSelect}
                            partSubComponents={buildCarSubcomponentsFromT2(availablePartsT2)}
                        />

                        {/* Selected Items Table (Desktop) / Cards (Mobile) */}
                        {selectedItems.length > 0 && (
                            <div style={{ marginTop: '20px', textAlign: 'left' }}>
                                <h4>{str("Selected Parts")} ({selectedItems.length})</h4>

                                {/* Desktop Table View */}
                                {!isMobile && (
                                    <table style={{
                                        width: '100%',
                                        borderCollapse: 'collapse',
                                        marginTop: '10px',
                                        border: '1px solid #ddd'
                                    }}>
                                        <thead>
                                            <tr style={{ backgroundColor: '#f5f5f5' }}>
                                                <th style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'left' }}>{str("Name")}</th>
                                                <th style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'left' }}>{str("Zone")}</th>
                                                <th style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'left' }}>{str("Group")}</th>
                                                <th style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'left' }}>{str("Actions")}</th>
                                                <th style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center', width: '60px' }}>{str("Details")}</th>
                                                <th style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center', width: '80px' }}>{str("Action")}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedItems.map((item, index) => {
                                                const actionDisplay = item.selectedAction
                                                    ? str(item.selectedAction)
                                                    : '-';
                                                return (
                                                    <tr key={index}>
                                                        <td style={{ padding: '8px', border: '1px solid #ddd' }}>{item.name}</td>
                                                        <td style={{ padding: '8px', border: '1px solid #ddd' }}>{item.zone || '-'}</td>
                                                        <td style={{ padding: '8px', border: '1px solid #ddd' }}>{item.group || '-'}</td>
                                                        <td style={{ padding: '8px', border: '1px solid #ddd', fontSize: '12px' }}>
                                                            {actionDisplay}
                                                        </td>
                                                        <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center' }}>
                                                            <button
                                                                onClick={() => handleShowDetails(item)}
                                                                style={{
                                                                    padding: '4px 8px',
                                                                    backgroundColor: '#3b82f6',
                                                                    color: 'white',
                                                                    border: 'none',
                                                                    borderRadius: '4px',
                                                                    cursor: 'pointer',
                                                                    fontSize: '14px',
                                                                    fontWeight: 'bold'
                                                                }}
                                                                title={str("Details")}
                                                            >
                                                                ⋯
                                                            </button>
                                                        </td>
                                                        <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center' }}>
                                                            <button
                                                                onClick={() => handleRequestDelete(item)}
                                                                style={{
                                                                    padding: '4px 12px',
                                                                    backgroundColor: '#dc2626',
                                                                    color: 'white',
                                                                    border: 'none',
                                                                    borderRadius: '4px',
                                                                    cursor: 'pointer',
                                                                    fontSize: '12px'
                                                                }}
                                                            >
                                                                {str("Remove")}
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                )}

                                {/* Mobile Card View */}
                                {isMobile && (
                                    <div style={{ marginTop: '10px' }}>
                                        {selectedItems.map((item, index) => {
                                            const actionDisplay = item.selectedAction
                                                ? str(item.selectedAction)
                                                : '-';
                                            return (
                                                <div
                                                    key={index}
                                                    style={{
                                                        border: '1px solid #ddd',
                                                        borderRadius: '6px',
                                                        padding: '12px',
                                                        marginBottom: '12px',
                                                        backgroundColor: '#fafafa'
                                                    }}
                                                >
                                                    <div style={{ marginBottom: '8px' }}>
                                                        <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#333' }}>
                                                            {item.name}
                                                        </div>
                                                    </div>

                                                    <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                                        <div>
                                                            <strong>{str("Zone")}:</strong> {item.zone || '-'}
                                                        </div>
                                                        <div>
                                                            <strong>{str("Group")}:</strong> {item.group || '-'}
                                                        </div>
                                                    </div>

                                                    <div style={{ fontSize: '13px', color: '#666', marginBottom: '12px' }}>
                                                        <strong>{str("Actions")}:</strong> {actionDisplay}
                                                    </div>

                                                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between' }}>
                                                        <button
                                                            onClick={() => handleShowDetails(item)}
                                                            style={{
                                                                flex: 1,
                                                                padding: '10px',
                                                                backgroundColor: '#3b82f6',
                                                                color: 'white',
                                                                border: 'none',
                                                                borderRadius: '4px',
                                                                cursor: 'pointer',
                                                                fontSize: '13px',
                                                                fontWeight: 'bold'
                                                            }}
                                                        >
                                                            {str("Details")}
                                                        </button>
                                                        <button
                                                            onClick={() => handleRequestDelete(item)}
                                                            style={{
                                                                flex: 1,
                                                                padding: '10px',
                                                                backgroundColor: '#dc2626',
                                                                color: 'white',
                                                                border: 'none',
                                                                borderRadius: '4px',
                                                                cursor: 'pointer',
                                                                fontSize: '13px',
                                                                fontWeight: 'bold'
                                                            }}
                                                        >
                                                            {str("Remove")}
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                ) : (
                    // Technical data display
                    <div style={{ textAlign: 'left' }}>
                        {/* Error Messages */}
                        {errors.length > 0 && (
                            <div style={{ marginBottom: '20px' }}>
                                {errors.map((err, idx) => (
                                    <Message
                                        key={idx}
                                        type="error"
                                        showIcon
                                        style={{ marginBottom: '10px' }}
                                    >
                                        <strong>[{err.context}]</strong> {err.message}
                                        <div style={{
                                            fontSize: '11px',
                                            marginTop: '5px',
                                            fontFamily: 'monospace',
                                            opacity: 0.8
                                        }}>
                                            {err.timestamp}
                                        </div>
                                    </Message>
                                ))}
                            </div>
                        )}

                        <Divider />

                        <h5>Car Configuration</h5>
                        <p><strong>Body Type:</strong> {body || 'Not set'}</p>
                        <p><strong>Class:</strong> {carClass || 'Not set'}</p>
                        <p><strong>Selected Parts:</strong> {selectedParts.length}</p>

                        <h5 style={{ marginTop: '20px' }}>Parts Visual Config</h5>
                        <ul>
                            {Object.keys(partsVisual).map(partKey => (
                                <li key={partKey}>
                                    {partKey}: {partsVisual[partKey].image || 'no image'}
                                    {partsVisual[partKey].mirrored && ' (mirrored)'}
                                </li>
                            ))}
                        </ul>

                        <Divider />

                        {/* Fetched Data Display */}
                        <h5>Fetched Data</h5>

                        <details style={{ marginBottom: '15px' }}>
                            <summary style={{ cursor: 'pointer', fontWeight: 'bold', marginBottom: '5px' }}>
                                Company Info {company && '✓'}
                            </summary>
                            <pre style={{
                                background: '#f5f5f5',
                                padding: '10px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontFamily: 'monospace',
                                overflow: 'auto',
                                maxHeight: '200px'
                            }}>
                                {JSON.stringify(company, null, 2)}
                            </pre>
                        </details>

                        <details style={{ marginBottom: '15px' }}>
                            <summary style={{ cursor: 'pointer', fontWeight: 'bold', marginBottom: '5px' }}>
                                Available Parts T1 ({availableParts.length}) {availableParts.length > 0 && '✓'}
                            </summary>
                            <pre style={{
                                background: '#f5f5f5',
                                padding: '10px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontFamily: 'monospace',
                                overflow: 'auto',
                                maxHeight: '200px'
                            }}>
                                {JSON.stringify(availableParts, null, 2)}
                            </pre>
                        </details>

                        <details style={{ marginBottom: '15px' }}>
                            <summary style={{ cursor: 'pointer', fontWeight: 'bold', marginBottom: '5px' }}>
                                Available Parts T2 ({availablePartsT2.length}) {availablePartsT2.length > 0 && '✓'}
                            </summary>
                            <pre style={{
                                background: '#f5f5f5',
                                padding: '10px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontFamily: 'monospace',
                                overflow: 'auto',
                                maxHeight: '200px'
                            }}>
                                {JSON.stringify(availablePartsT2, null, 2)}
                            </pre>
                        </details>

                        <details style={{ marginBottom: '15px' }}>
                            <summary style={{ cursor: 'pointer', fontWeight: 'bold', marginBottom: '5px' }}>
                                Processors ({processors.length}) {processors.length > 0 && '✓'}
                            </summary>
                            <pre style={{
                                background: '#f5f5f5',
                                padding: '10px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontFamily: 'monospace',
                                overflow: 'auto',
                                maxHeight: '200px'
                            }}>
                                {JSON.stringify(processors, null, 2)}
                            </pre>
                        </details>

                        <Divider />

                        <h5>Calculations</h5>
                        <pre style={{
                            background: '#f5f5f5',
                            padding: '10px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontFamily: 'monospace',
                            overflow: 'auto',
                            maxHeight: '200px'
                        }}>
                            {JSON.stringify(calculations, null, 2)}
                        </pre>

                        <div style={{ marginTop: '20px' }}>
                            <button
                                onClick={() => onChange && onChange(['test_part'])}
                                style={{ marginRight: '10px' }}
                            >
                                Test onChange
                            </button>

                            <button
                                onClick={() => setCalculations && setCalculations({ test: 'value' })}
                            >
                                Test setCalculations
                            </button>

                            <button
                                onClick={() => setErrors([])}
                                style={{ marginLeft: '10px' }}
                                disabled={errors.length === 0}
                            >
                                Clear Errors ({errors.length})
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Part Details Drawer */}
            <Drawer
                open={drawerOpen}
                onClose={handleDrawerSave}
                size={isMobile ? 'full' : 'lg'}
            >
                <Drawer.Header>
                    <Drawer.Title>{drawerPartDetails?.name || str("Part Details")}</Drawer.Title>
                    <Drawer.Actions>
                        <Button
                            onClick={handleDrawerCancel}
                            appearance="subtle"
                            startIcon={<X size={18} />}
                        >
                            {!isMobile && str("Cancel")}
                        </Button>
                        <Button
                            onClick={handleDrawerSave}
                            appearance="primary"
                            color="green"
                            startIcon={<Check size={18} />}
                        >
                            {!isMobile && str("Save")}
                        </Button>
                    </Drawer.Actions>
                </Drawer.Header>
                <Drawer.Body>
                    {editedPart ? (
                        <div style={{ padding: '10px' }}>
                            <div style={{ marginBottom: '15px' }}>
                                <strong>{str("Name")}:</strong> {editedPart.name}
                            </div>

                            <div style={{ marginBottom: '15px' }}>
                                <strong>{str("Zone")}:</strong> {drawerPartDetails?.zone || '-'}
                            </div>

                            <div style={{ marginBottom: '15px' }}>
                                <strong>{str("Group")}:</strong> {drawerPartDetails?.group || '-'}
                            </div>

                            <Divider />

                            {/* Action Selection */}
                            {drawerPartDetails?.actions && drawerPartDetails.actions.length > 0 && (
                                <div style={{ marginTop: '20px', marginBottom: '20px' }}>
                                    <MenuPickerV2
                                        label={str("Action")}
                                        items={drawerPartDetails.actions.map(action => ({
                                            label: str(action),
                                            value: action
                                        }))}
                                        value={editedPart.action}
                                        onSelect={(value) => setEditedPart(prev => ({ ...prev, action: value }))}
                                        style={{ maxWidth: '100%' }}
                                    />
                                </div>
                            )}

                            {/* Damage Level */}
                            <div style={{ marginTop: '20px', marginBottom: '20px' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                                    {str("Damage Level")}
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    max="10"
                                    value={editedPart.damageLevel}
                                    onChange={(e) => setEditedPart(prev => ({
                                        ...prev,
                                        damageLevel: parseInt(e.target.value) || 0
                                    }))}
                                    style={{
                                        width: '100%',
                                        padding: '8px',
                                        borderRadius: '4px',
                                        border: '1px solid #ddd',
                                        fontSize: '14px'
                                    }}
                                />
                            </div>

                            {/* Original Part Checkbox */}
                            <div style={{ marginTop: '15px', marginBottom: '15px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={editedPart.original}
                                        onChange={(e) => setEditedPart(prev => ({
                                            ...prev,
                                            original: e.target.checked
                                        }))}
                                        style={{ marginRight: '8px', width: '16px', height: '16px' }}
                                    />
                                    <span>{str("Original Part")}</span>
                                </label>
                            </div>

                            {/* Replace Part Checkbox */}
                            <div style={{ marginTop: '15px', marginBottom: '15px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={editedPart.replace}
                                        onChange={(e) => setEditedPart(prev => ({
                                            ...prev,
                                            replace: e.target.checked
                                        }))}
                                        style={{ marginRight: '8px', width: '16px', height: '16px' }}
                                    />
                                    <span>{str("Replace Part")}</span>
                                </label>
                            </div>

                            <Divider />

                            {/* Show all available properties */}
                            {drawerPartDetails && Object.keys(drawerPartDetails).length > 0 && (
                                <div style={{ marginTop: '20px' }}>
                                    <Divider />
                                    <details>
                                        <summary style={{ cursor: 'pointer', fontWeight: 'bold', marginBottom: '10px' }}>
                                            {str("Raw Data")}
                                        </summary>
                                        <pre style={{
                                            background: '#f5f5f5',
                                            padding: '10px',
                                            borderRadius: '4px',
                                            fontSize: '11px',
                                            fontFamily: 'monospace',
                                            overflow: 'auto',
                                            maxHeight: '400px'
                                        }}>
                                            {JSON.stringify({ original: drawerPartDetails, edited: editedPart }, null, 2)}
                                        </pre>
                                    </details>
                                </div>
                            )}
                        </div>
                    ) : (
                        <Message type="info">{str("No additional information available")}</Message>
                    )}
                </Drawer.Body>
            </Drawer>

            {/* Delete Confirmation Modal */}
            <Modal
                open={deleteConfirmOpen}
                onClose={() => setDeleteConfirmOpen(false)}
                size="xs"
            >
                <Modal.Header>
                    <Modal.Title>{str("Confirm Deletion")}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <p>{str("Are you sure you want to remove this part?")}</p>
                    {itemToDelete && (
                        <p style={{ marginTop: '10px', fontWeight: 'bold' }}>
                            {itemToDelete.name}
                        </p>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button onClick={handleConfirmDelete} appearance="primary" color="red">
                        {str("Remove")}
                    </Button>
                    <Button onClick={() => setDeleteConfirmOpen(false)} appearance="subtle">
                        {str("Cancel")}
                    </Button>
                </Modal.Footer>
            </Modal>
        </Panel>
    );
};

CarBodyMain.propTypes = {
    partsVisual: PropTypes.objectOf(
        PropTypes.shape({
            image: PropTypes.string,
            mirrored: PropTypes.bool,
            x: PropTypes.number,
            y: PropTypes.number,
            unused: PropTypes.arrayOf(PropTypes.string)
        })
    ).isRequired,
    selectedParts: PropTypes.array.isRequired,
    onChange: PropTypes.func,
    carClass: PropTypes.string.isRequired,
    body: PropTypes.string.isRequired,
    calculations: PropTypes.object,
    setCalculations: PropTypes.func,
    className: PropTypes.string,
    style: PropTypes.object
};

CarBodyMain.defaultProps = {
    onChange: () => { },
    carClass: '',
    body: '',
    calculations: {},
    setCalculations: () => { },
    className: '',
    style: {}
};

export default CarBodyMain;