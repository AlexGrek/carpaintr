import { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Divider, Panel, Message, Drawer } from 'rsuite';
import { useMediaQuery } from 'react-responsive';
import { useLocale, registerTranslations } from '../../localization/LocaleContext';
import { authFetch, getOrFetchCompanyInfo } from '../../utils/authFetch';
import { make_sandbox_extensions, verify_processor } from '../../calc/processor_evaluator';
import CarDiagram, { buildCarSubcomponentsFromT2 } from './diagram/CarDiagram';

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
                // Add item
                return [...prev, item];
            }
        });
    }, []);

    const handleShowDetails = useCallback((item) => {
        setDrawerPartDetails(item);
        setDrawerOpen(true);
    }, []);

    const [errors, setErrors] = useState([]);

    const [availableParts, setAvailableParts] = useState([]);
    const [availablePartsT2, setAvailablePartsT2] = useState([]);
    const [processors, setProcessors] = useState([]);
    const [selectedItems, setSelectedItems] = useState([]);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [drawerPartDetails, setDrawerPartDetails] = useState(null);

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

                        {/* Selected Items Table */}
                        {selectedItems.length > 0 && (
                            <div style={{ marginTop: '20px', textAlign: 'left' }}>
                                <h4>{str("Selected Parts")} ({selectedItems.length})</h4>
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
                                            <th style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center', width: '60px' }}>{str("Details")}</th>
                                            <th style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center', width: '80px' }}>{str("Action")}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedItems.map((item, index) => (
                                            <tr key={index}>
                                                <td style={{ padding: '8px', border: '1px solid #ddd' }}>{item.name}</td>
                                                <td style={{ padding: '8px', border: '1px solid #ddd' }}>{item.zone || '-'}</td>
                                                <td style={{ padding: '8px', border: '1px solid #ddd' }}>{item.group || '-'}</td>
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
                                                        onClick={() => handleDiagramSelect(item)}
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
                                        ))}
                                    </tbody>
                                </table>
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
                onClose={() => setDrawerOpen(false)}
                size={isMobile ? 'full' : 'sm'}
            >
                <Drawer.Header>
                    <Drawer.Title>{drawerPartDetails?.name || str("Part Details")}</Drawer.Title>
                    <Drawer.Actions>
                        <button
                            onClick={() => setDrawerOpen(false)}
                            style={{
                                padding: '6px 16px',
                                backgroundColor: '#666',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '14px'
                            }}
                        >
                            {str("Close")}
                        </button>
                    </Drawer.Actions>
                </Drawer.Header>
                <Drawer.Body>
                    {drawerPartDetails ? (
                        <div style={{ padding: '10px' }}>
                            <div style={{ marginBottom: '15px' }}>
                                <strong>{str("Zone")}:</strong> {drawerPartDetails.zone || '-'}
                            </div>

                            <div style={{ marginBottom: '15px' }}>
                                <strong>{str("Group")}:</strong> {drawerPartDetails.group || '-'}
                            </div>

                            {/* Show all available properties */}
                            {Object.keys(drawerPartDetails).length > 0 && (
                                <div style={{ marginTop: '20px' }}>
                                    <Divider />
                                    <details>
                                        <summary style={{ cursor: 'pointer', fontWeight: 'bold', marginBottom: '10px' }}>
                                            Raw Data
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
                                            {JSON.stringify(drawerPartDetails, null, 2)}
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