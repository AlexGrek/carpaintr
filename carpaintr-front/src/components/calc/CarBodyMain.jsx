
import { useCallback, useEffect, useState, useRef } from 'react';
import PropTypes from 'prop-types';
import { Divider, Panel, Message, Drawer, Modal, Button, Tabs } from 'rsuite';
import { useMediaQuery } from 'react-responsive';
import { Check, X, MoreHorizontal, Trash2, Bug } from 'lucide-react';
import { useLocale, registerTranslations } from '../../localization/LocaleContext';
import { authFetch, getOrFetchCompanyInfo } from '../../utils/authFetch';
import {
    make_sandbox_extensions,
    make_sandbox,
    verify_processor,
    evaluate_processor,
    is_supported_repair_type,
    validate_requirements,
    validate_null_tables,
} from '../../calc/processor_evaluator';
import CarDiagram, { buildCarSubcomponentsFromT2 } from './diagram/CarDiagram';
import MenuPickerV2 from '../layout/MenuPickerV2';
import GridDraw from './GridDraw';
import { EvaluationResultsTable } from './EvaluationResultsTable';
import { stripExt } from '../../utils/utils';

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
    "Quick Select": "Quick Select",
    "Damage Map": "Damage Map",
    "None": "None",
    "Light": "Light",
    "Medium": "Medium",
    "Severe": "Severe",
    "Critical": "Critical",
    "cells": "cells",
    "Calculations": "Calculations",
    "Select an action to calculate": "Select an action to calculate",
    "Failed to load table data": "Failed to load table data",
    "Retry": "Retry",
    "Loading table data...": "Loading table data...",
    "Car Body": "Car Body",
    "Class": "Class",
    "Unknown": "Unknown",
    "sedan": "sedan",
    "wagon": "wagon",
    "coupe": "coupe",
    "liftback": "liftback",
    "hatchback 5 doors": "hatchback 5 doors",
    "hatchback 3 doors": "hatchback 3 doors",
    "suv 3 doors": "suv 3 doors",
    "suv 5 doors": "suv 5 doors",
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
    "Quick Select": "Швидкий вибір",
    "Damage Map": "Карта пошкоджень",
    "None": "Немає",
    "Light": "Легке",
    "Medium": "Середнє",
    "Severe": "Сильне",
    "Critical": "Критичне",
    "cells": "клітинок",
    "Calculations": "Розрахунки",
    "Select an action to calculate": "Виберіть дію для розрахунку",
    "Failed to load table data": "Не вдалося завантажити дані таблиці",
    "Retry": "Повторити",
    "Loading table data...": "Завантаження даних таблиці...",
    "Car Body": "Кузов",
    "Class": "Клас",
    "Unknown": "Невідомо",
    "sedan": "седан",
    "wagon": "універсал",
    "coupe": "купе",
    "liftback": "ліфтбек",
    "hatchback 5 doors": "хетчбек 5 дверей",
    "hatchback 3 doors": "хетчбек 3 двері",
    "suv 3 doors": "позашляховик 3 двері",
    "suv 5 doors": "позашляховик 5 дверей",
    "No details, click \"...\" to add details": "Немає даних, натисніть «...» щоб додати деталі",
    "Required table \"%s\" not found. Available: [%s]": "Обов'язкова таблиця \"%s\" не знайдена. Доступні: [%s]",
    "Table \"%s\" loaded but data is null — server returned no rows. Required: [%s]": "Таблиця \"%s\" завантажена, але дані порожні — сервер не повернув рядків. Обов'язкові: [%s]",
});

const DAMAGE_LEVELS = [
    { value: 0, label: "None", color: "#e0e0e0" },
    { value: 2, label: "Light", color: "#fadb14" },
    { value: 5, label: "Medium", color: "#fa8c16" },
    { value: 7, label: "Severe", color: "#f5222d" },
    { value: 10, label: "Critical", color: "#722ed1" },
];

function procToPath(name) {
    return `procs/${name.replace(/ /g, '_')}.js`;
}

function tableToPath(name) {
    return `tables/${name}.csv`;
}

function flattenFileTree(node, prefix = '') {
    const result = new Set();
    if (node?.Directory?.children) {
        for (const child of node.Directory.children) {
            if ('File' in child) {
                result.add(prefix + child.File.name);
            } else if ('Directory' in child) {
                const sub = flattenFileTree(child, prefix + child.Directory.name + '/');
                for (const p of sub) result.add(p);
            }
        }
    }
    return result;
}

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

    const mapVisual = useCallback((partName) => {
        if (partName && partsVisual[partName]) {
            return partsVisual[partName];
        }
        return partsVisual.default;
    }, [partsVisual]);

    const generateInitialGrid = useCallback((visual) => {
        if (!visual) return [];
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
        return grid;
    }, []);

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

    const [tableDataRepository, setTableDataRepository] = useState({});
    const [fetchErrors, setFetchErrors] = useState({}); // { partName: errorMessage }
    const [showDebugMode, setShowDebugMode] = useState(false);
    const [evaluatorLogs, setEvaluatorLogs] = useState({}); // { partName: LogEntry[] }
    const [partDebugOpen, setPartDebugOpen] = useState({}); // { partName: bool }
    const [userFiles, setUserFiles] = useState(new Set());
    const lastEvaluatedRef = useRef({}); // { partName: action } - track what's been evaluated
    const fetchingPartsRef = useRef(new Set()); // prevent duplicate fetches

    // Fetch user file list once to determine User vs Common links in debug UI
    useEffect(() => {
        authFetch('/api/v1/editor/list_user_files')
            .then(r => r.ok ? r.json() : null)
            .then(data => { if (data) setUserFiles(flattenFileTree(data)); })
            .catch(() => {});
    }, []);

    const getEditorUrl = useCallback((filePath) => {
        const fs = userFiles.has(filePath) ? 'User' : 'Common';
        return `/app/fileeditor?fs=${fs}&path=${encodeURIComponent(filePath)}`;
    }, [userFiles]);

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
        const visual = mapVisual(partToEdit.name);
        const grid = partToEdit.grid || generateInitialGrid(visual);
        const hasGridData = grid.some(row => row.some(cell => cell > 0));
        setEditedPart({
            name: partToEdit.name,
            action: partToEdit.selectedAction || partToEdit.action || null,
            damageLevel: partToEdit.damageLevel ?? 0,
            original: partToEdit.original ?? true,
            replace: partToEdit.replace ?? false,
            grid,
            damageLevelMode: partToEdit.damageLevelMode || (hasGridData ? 'grid' : 'simple'),
        });
        setDrawerOpen(true);
    }, [selectedItems, mapVisual, generateInitialGrid]);

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
                        damageLevelMode: editedPart.damageLevelMode,
                        original: editedPart.original,
                        replace: editedPart.replace,
                        grid: editedPart.grid,
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

    // Seed lastEvaluatedRef from existing calculations prop on mount,
    // so returning to this stage doesn't overwrite manual overrides.
    useEffect(() => {
        if (!calculations || Object.keys(calculations).length === 0) return;
        if (!selectedParts || !Array.isArray(selectedParts)) return;
        selectedParts.forEach(part => {
            const action = part.action || part.selectedAction || null;
            if (action && calculations[part.name]?.length > 0) {
                lastEvaluatedRef.current[part.name] = action;
            }
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Run once on mount only

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
                // Mark as external update to prevent calling onChange
                isInternalUpdate.current = true;
                setSelectedItems(converted);

                // Reset flag after state update completes
                setTimeout(() => {
                    isInternalUpdate.current = false;
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

        if (isUserChange && onChange && hasChanged) {
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

    // Unified fetch handler
    const fetchData = useCallback(async (url, context, onSuccess) => {
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

            onSuccess(data);

        } catch (error) {
            handleError(context, error);
        }
    }, [handleError]);

    // Fetch table data for a single part (armored against duplicate fetches)
    const fetchTableDataForPart = useCallback(async (partName) => {
        if (fetchingPartsRef.current.has(partName)) return;
        fetchingPartsRef.current.add(partName);
        setFetchErrors(prev => { const next = { ...prev }; delete next[partName]; return next; });

        const params = new URLSearchParams({ car_class: carClass, car_type: body, part: partName });
        try {
            const response = await authFetch(`/api/v1/user/lookup_all_tables?${params}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            const data = await response.json();
            if (Array.isArray(data)) {
                const preprocessed = data.map(table => ({
                    name: stripExt(table[0]),
                    data: table[1],
                    file: table[0],
                }));
                setTableDataRepository(prev => ({ ...prev, [partName]: preprocessed }));
            }
        } catch (error) {
            handleError(`Table Data: ${partName}`, error);
            setFetchErrors(prev => ({ ...prev, [partName]: error.message || 'Unknown error' }));
            fetchingPartsRef.current.delete(partName); // allow retry
        }
    }, [carClass, body, handleError]);

    // Fetch table data whenever a new part appears that we don't have data for yet
    useEffect(() => {
        if (!carClass || !body) return;
        selectedItems.forEach(item => {
            if (tableDataRepository[item.name] === undefined && !fetchingPartsRef.current.has(item.name)) {
                fetchTableDataForPart(item.name);
            }
        });
    }, [selectedItems, tableDataRepository, carClass, body, fetchTableDataForPart]);

    // Evaluate processors for each selected part whenever inputs change.
    // Uses lastEvaluatedRef to skip re-evaluation when (part, action) hasn't changed,
    // so manual overrides in EvaluationResultsTable are preserved across unrelated updates.
    useEffect(() => {
        if (!processors.length || !company) return;

        // Clean up tracking for removed parts
        const currentNames = new Set(selectedItems.map(i => i.name));
        Object.keys(lastEvaluatedRef.current).forEach(name => {
            if (!currentNames.has(name)) delete lastEvaluatedRef.current[name];
        });

        const updates = {};
        const logUpdates = {};
        selectedItems.forEach(item => {
            const action = item.selectedAction || item.action || null;
            const tableData = tableDataRepository[item.name];
            if (!action || !tableData) return;

            // Skip if this exact (part, action) was already evaluated
            if (lastEvaluatedRef.current[item.name] === action) return;

            const tdata = tableData.reduce((acc, t) => { acc[t.name] = t.data; return acc; }, {});
            const stuff = {
                repairAction: action,
                files: [],
                carClass,
                carBodyType: body,
                carYear: 1999,
                carModel: {},
                tableData: tdata,
                paint: {},
                pricing: company.pricing_preferences,
                carPart: item,
            };

            const results = [];
            const debugLogs = [];

            processors.forEach(proc => {
                // Check 1: required tables present?
                const missingTable = validate_requirements(proc, tdata);
                if (missingTable !== null) {
                    debugLogs.push({
                        processorName: proc.name,
                        category: proc.category,
                        orderingNum: proc.orderingNum,
                        tables: proc.requiredTables,
                        status: 'skipped',
                        reason: 'missing_table',
                        detail: str('Required table "%s" not found. Available: [%s]')
                                .replace('%s', missingTable)
                                .replace('%s', Object.keys(tdata).join(', ')),
                    });
                    return;
                }

                // Check 1b: required tables loaded but null (fetch returned no data)?
                const nullTable = validate_null_tables(proc, tdata);
                if (nullTable !== null) {
                    debugLogs.push({
                        processorName: proc.name,
                        category: proc.category,
                        orderingNum: proc.orderingNum,
                        tables: proc.requiredTables,
                        status: 'error',
                        reason: 'null_table',
                        detail: str('Table "%s" loaded but data is null — server returned no rows. Required: [%s]')
                                .replace('%s', nullTable)
                                .replace('%s', proc.requiredTables.join(', ')),
                    });
                    return;
                }

                // Check 2: action is supported?
                if (!is_supported_repair_type(proc, action)) {
                    debugLogs.push({
                        processorName: proc.name,
                        category: proc.category,
                        orderingNum: proc.orderingNum,
                        tables: proc.requiredTables,
                        status: 'skipped',
                        reason: 'unsupported_action',
                        detail: `Action "${action}" not in requiredRepairTypes: [${proc.requiredRepairTypes.join(', ')}]`,
                    });
                    return;
                }

                // Check 3: shouldRun() condition
                let shouldRunResult = false;
                let shouldRunError = null;
                try {
                    shouldRunResult = proc.shouldRun(
                        make_sandbox(),
                        stuff.carPart,
                        stuff.tableData,
                        stuff.repairAction,
                        stuff.files,
                        stuff.carClass,
                        stuff.carBodyType,
                        stuff.carYear,
                        stuff.carModel,
                        stuff.paint,
                        stuff.pricing,
                    );
                } catch (e) {
                    shouldRunError = e?.message || String(e);
                }

                if (shouldRunError) {
                    debugLogs.push({
                        processorName: proc.name,
                        category: proc.category,
                        orderingNum: proc.orderingNum,
                        tables: proc.requiredTables,
                        status: 'error',
                        reason: 'shouldRun_threw',
                        detail: `shouldRun() threw: ${shouldRunError}`,
                    });
                    return;
                }

                if (!shouldRunResult) {
                    debugLogs.push({
                        processorName: proc.name,
                        category: proc.category,
                        orderingNum: proc.orderingNum,
                        tables: proc.requiredTables,
                        status: 'skipped',
                        reason: 'shouldRun_false',
                        detail: 'shouldRun() returned false',
                    });
                    return;
                }

                // Step 4: run the processor
                const result = evaluate_processor(proc, stuff);
                if (result.error) {
                    debugLogs.push({
                        processorName: proc.name,
                        category: proc.category,
                        orderingNum: proc.orderingNum,
                        tables: proc.requiredTables,
                        status: 'error',
                        reason: 'run_threw',
                        detail: result.text,
                    });
                } else {
                    debugLogs.push({
                        processorName: proc.name,
                        category: proc.category,
                        orderingNum: proc.orderingNum,
                        tables: proc.requiredTables,
                        status: 'applied',
                        detail: `${result.result?.length ?? 0} row(s)`,
                        rows: result.result?.map(r => ({ name: r.name, estimation: r.estimation, tooltip: r.tooltip })),
                    });
                    results.push(result);
                }
            });

            lastEvaluatedRef.current[item.name] = action;
            updates[item.name] = results;
            logUpdates[item.name] = debugLogs;
        });

        if (Object.keys(updates).length > 0) {
            setCalculations(prev => ({ ...prev, ...updates }));
        }
        if (Object.keys(logUpdates).length > 0) {
            setEvaluatorLogs(prev => ({ ...prev, ...logUpdates }));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedItems, processors, company, tableDataRepository, carClass, body]);

    // Effect to fetch company info and car parts
    useEffect(() => {
        const updateCompanyInfo = async () => {
            try {
                const info = await getOrFetchCompanyInfo();
                if (info != null) {
                    setCompany(info);
                }
            } catch (error) {
                handleError('Company Info', error);
            }
        };

        updateCompanyInfo();

        if (carClass == null || body == null) {
            return;
        }

        // Reset state
        setAvailableParts([]);
        setAvailablePartsT2([]);
        setProcessors([]);
        setErrors([]);
        setTableDataRepository({});
        setFetchErrors({});
        setEvaluatorLogs({});
        lastEvaluatedRef.current = {};
        fetchingPartsRef.current = new Set();

        // Fetch processors bundle
        fetchData(
            '/api/v1/user/processors_bundle',
            'Processors Bundle',
            (code) => {
                try {
                    const sandbox = { exports: {}, ...make_sandbox_extensions() };
                    new Function("exports", code)(sandbox.exports);
                    const plugins = sandbox.exports.default.map((p) => verify_processor(p));
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
            header={`${str("Car Body")}: ${str(body) || str('Unknown')} (${str("Class")} ${carClass || 'N/A'})`}
            className={className}
            style={{
                ...style,
                position: 'relative',
                maxWidth: '900px',
                margin: '0 auto',
                width: '100%'
            }}
        >
            {/* Debug mode toggle button */}
            <button
                onClick={() => setShowDebugMode(prev => !prev)}
                style={{
                    position: 'absolute',
                    top: '10px',
                    right: '44px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    opacity: showDebugMode ? 0.9 : 0.2,
                    transition: 'opacity 0.2s',
                    padding: '5px',
                    color: showDebugMode ? '#d97706' : '#666',
                    display: 'flex',
                    alignItems: 'center',
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '0.7'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = showDebugMode ? '0.9' : '0.2'}
                title="Toggle evaluator debug mode"
            >
                <Bug size={16} />
            </button>

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

                        {/* Parts with Calculations */}
                        {selectedItems.length > 0 && (
                            <div style={{ marginTop: '20px', textAlign: 'left' }}>
                                <h4 style={{ marginBottom: '8px' }}>{str("Selected Parts")} ({selectedItems.length})</h4>
                                {selectedItems.map((item) => {
                                    const action = item.selectedAction || item.action;
                                    const calcData = calculations?.[item.name];
                                    const fetchError = fetchErrors[item.name];
                                    const isItemLoading = fetchingPartsRef.current.has(item.name) && !tableDataRepository[item.name] && !fetchError;
                                    const hasCalcData = calcData && calcData.length > 0;
                                    const dmgLevel = DAMAGE_LEVELS.find(d => d.value === item.damageLevel);
                                    const gridFlat = item.grid ? item.grid.flat().filter(c => c !== -1) : [];
                                    const gridMarked = gridFlat.filter(c => c > 0).length;
                                    const gridTotal = gridFlat.length;
                                    const gridPct = gridTotal > 0 ? Math.round((gridMarked / gridTotal) * 100) : 0;
                                    const panelHeader = (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                                            <span style={{ fontWeight: 600, fontSize: '14px' }}>{item.name}</span>
                                            {action && (
                                                <span style={{ fontSize: '12px', color: '#555', backgroundColor: '#f0f4ff', padding: '1px 8px', borderRadius: '10px', flexShrink: 0 }}>
                                                    {str(action)}
                                                </span>
                                            )}
                                            {item.damageLevelMode === 'grid' ? (
                                                gridMarked > 0 && (
                                                    <span style={{ fontSize: '11px', color: '#666', flexShrink: 0 }}>
                                                        {gridMarked}/{gridTotal} ({gridPct}%)
                                                    </span>
                                                )
                                            ) : (dmgLevel && dmgLevel.value > 0 ? (
                                                <span style={{
                                                    display: 'inline-block',
                                                    padding: '1px 8px',
                                                    borderRadius: '10px',
                                                    backgroundColor: dmgLevel.color,
                                                    color: '#fff',
                                                    fontSize: '11px',
                                                    fontWeight: 600,
                                                    flexShrink: 0,
                                                }}>
                                                    {str(dmgLevel.label)}
                                                </span>
                                            ) : null)}
                                            <div
                                                style={{ marginLeft: 'auto', display: 'flex', gap: '6px', flexShrink: 0 }}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleShowDetails(item); }}
                                                    style={{
                                                        padding: isMobile ? '4px 6px' : '5px 7px',
                                                        backgroundColor: '#3b82f6',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '5px',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                    }}
                                                    title={str("Details")}
                                                >
                                                    <MoreHorizontal size={14} />
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleRequestDelete(item); }}
                                                    style={{
                                                        padding: isMobile ? '4px 6px' : '5px 7px',
                                                        backgroundColor: '#ef4444',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '5px',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                    }}
                                                    title={str("Remove")}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    );

                                    return (
                                        <Panel
                                            key={item.name}
                                            collapsible
                                            defaultExpanded={true}
                                            header={panelHeader}
                                            style={{ marginBottom: '8px' }}
                                        >
                                            <>
                                                {fetchError ? (
                                                    <div>
                                                        <Message type="error" showIcon style={{ marginBottom: '6px' }}>
                                                            {str("Failed to load table data")} — {fetchError}
                                                        </Message>
                                                        <Button size="xs" appearance="ghost" color="blue" onClick={() => fetchTableDataForPart(item.name)}>
                                                            {str("Retry")}
                                                        </Button>
                                                    </div>
                                                ) : isItemLoading ? (
                                                    <div style={{ color: '#999', fontSize: '13px' }}>
                                                        {str("Loading table data...")}
                                                    </div>
                                                ) : hasCalcData ? (
                                                    <EvaluationResultsTable
                                                        data={calcData}
                                                        setData={(newData) => setCalculations(prev => ({ ...prev, [item.name]: newData }))}
                                                        currency={company?.pricing_preferences?.norm_price?.currency ?? ''}
                                                        basePrice={company?.pricing_preferences?.norm_price?.amount ?? 1}
                                                        skipIncorrect={true}
                                                    />
                                                ) : (
                                                    <div style={{ color: '#aaa', fontSize: '13px', fontStyle: 'italic', padding: '4px 0' }}>
                                                        {str('No details, click "..." to add details')}
                                                    </div>
                                                )}
                                                <div style={{ marginTop: '6px', display: 'flex', justifyContent: 'flex-end' }}>
                                                    <button
                                                        onClick={() => setPartDebugOpen(prev => ({ ...prev, [item.name]: !prev[item.name] }))}
                                                        style={{
                                                            width: '20px',
                                                            height: '20px',
                                                            fontSize: '12px',
                                                            border: '1px solid #d1d5db',
                                                            borderRadius: '50%',
                                                            backgroundColor: partDebugOpen[item.name] ? '#eff6ff' : 'transparent',
                                                            color: partDebugOpen[item.name] ? '#3b82f6' : '#9ca3af',
                                                            cursor: 'pointer',
                                                            lineHeight: 1,
                                                            fontWeight: 700,
                                                            padding: 0,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                        }}
                                                        title="Show processor debug info"
                                                    >
                                                        ?
                                                    </button>
                                                </div>
                                                {partDebugOpen[item.name] && evaluatorLogs[item.name] && (
                                                    <div style={{
                                                        marginTop: '8px',
                                                        borderLeft: '3px solid #d97706',
                                                        backgroundColor: '#fffbeb',
                                                        borderRadius: '0 4px 4px 0',
                                                        padding: '8px 10px',
                                                    }}>
                                                        <div style={{ fontSize: '11px', color: '#92400e', fontWeight: 600, marginBottom: '6px' }}>
                                                            🐛&nbsp;
                                                            {evaluatorLogs[item.name].filter(l => l.status === 'applied').length} applied &nbsp;·&nbsp;
                                                            {evaluatorLogs[item.name].filter(l => l.status === 'skipped').length} skipped &nbsp;·&nbsp;
                                                            {evaluatorLogs[item.name].filter(l => l.status === 'error').length} errors
                                                            &nbsp;({evaluatorLogs[item.name].length} total)
                                                        </div>
                                                        <div style={{ fontFamily: 'monospace', fontSize: '11px', lineHeight: '1.6' }}>
                                                            {evaluatorLogs[item.name].map((log, logIdx) => (
                                                                <div key={logIdx} style={{
                                                                    padding: '3px 6px',
                                                                    marginBottom: '2px',
                                                                    borderRadius: '3px',
                                                                    backgroundColor:
                                                                        log.status === 'applied' ? '#f0fdf4' :
                                                                        log.status === 'error'   ? '#fef2f2' :
                                                                        '#f3f4f6',
                                                                    color:
                                                                        log.status === 'applied' ? '#166534' :
                                                                        log.status === 'error'   ? '#dc2626' :
                                                                        '#6b7280',
                                                                }}>
                                                                    <span style={{ marginRight: '6px' }}>
                                                                        {log.status === 'applied' ? '✅' : log.status === 'error' ? '❌' : '⏭'}
                                                                    </span>
                                                                    <strong>
                                                                        <a
                                                                            href={getEditorUrl(procToPath(log.processorName || ''))}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            style={{ color: 'inherit', textDecoration: 'underline', textDecorationStyle: 'dotted' }}
                                                                        >
                                                                            {log.processorName || '(unnamed)'}
                                                                        </a>
                                                                    </strong>
                                                                    {log.category && (
                                                                        <span style={{ opacity: 0.6, marginLeft: '6px', fontWeight: 'normal' }}>
                                                                            [{log.category}#{log.orderingNum}]
                                                                        </span>
                                                                    )}
                                                                    <span style={{ marginLeft: '8px', fontWeight: 'normal', opacity: 0.9 }}>
                                                                        {log.detail}
                                                                    </span>
                                                                    {log.tables && log.tables.length > 0 && (
                                                                        <div style={{ marginLeft: '28px', marginTop: '3px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                                                            {log.tables.map((tbl, ti) => (
                                                                                <a
                                                                                    key={ti}
                                                                                    href={getEditorUrl(tableToPath(tbl))}
                                                                                    target="_blank"
                                                                                    rel="noopener noreferrer"
                                                                                    style={{
                                                                                        fontSize: '10px',
                                                                                        backgroundColor: '#e0e7ff',
                                                                                        color: '#3730a3',
                                                                                        borderRadius: '3px',
                                                                                        padding: '1px 5px',
                                                                                        textDecoration: 'none',
                                                                                        fontFamily: 'monospace',
                                                                                    }}
                                                                                >
                                                                                    {tbl}
                                                                                </a>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                    {log.rows && log.rows.length > 0 && (
                                                                        <div style={{ marginLeft: '28px', marginTop: '2px' }}>
                                                                            {log.rows.map((row, ri) => (
                                                                                <div key={ri} style={{ fontSize: '10px', color: '#374151' }}>
                                                                                    ↳ {row.name}: <strong>{row.estimation}</strong>
                                                                                    {row.tooltip && (
                                                                                        <span style={{ opacity: 0.5, marginLeft: '4px' }}>
                                                                                            ({row.tooltip})
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        </Panel>
                                    );
                                })}
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

                        {/* Debug-only test buttons — intentionally pass wrong types to verify prop plumbing */}
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

                            {/* Action Selection — uses repair_types.csv per-part values so they
                                match processor requiredRepairTypes (Ukrainian names). Falls back
                                to T2 action codes, then to the full 6-action default list. */}
                            {(() => {
                                const partTableData = tableDataRepository[drawerPartDetails?.name];
                                const repairTypesEntry = partTableData?.find(t => t.name === 'repair_types');
                                const repairTypesStr = repairTypesEntry?.data?.['Ремонти'] || '';
                                const fromTable = repairTypesStr
                                    .split('/')
                                    .map(s => s.trim())
                                    .filter(Boolean);

                                const items = fromTable.length > 0
                                    ? fromTable.map(rt => ({ label: rt, value: rt }))
                                    : (drawerPartDetails?.actions?.length > 0
                                        ? drawerPartDetails.actions.map(a => ({ label: str(a), value: a }))
                                        : ['assemble', 'twist', 'replace', 'mount', 'repair', 'paint'].map(a => ({ label: str(a), value: a })));

                                return (
                                    <div style={{ marginTop: '20px', marginBottom: '20px' }}>
                                        <MenuPickerV2
                                            label={str("Action")}
                                            items={items}
                                            value={editedPart.action}
                                            onSelect={(value) => setEditedPart(prev => ({ ...prev, action: value }))}
                                            style={{ maxWidth: '100%' }}
                                        />
                                    </div>
                                );
                            })()}

                            {/* Damage Level - hidden for replace/mount actions */}
                            {editedPart.action !== 'replace' && editedPart.action !== 'mount' && (
                            <div style={{ marginTop: '20px', marginBottom: '20px' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                                    {str("Damage Level")}
                                </label>
                                <Tabs
                                    activeKey={editedPart.damageLevelMode || 'simple'}
                                    onSelect={(key) => {
                                        if (key === 'simple') {
                                            setEditedPart(prev => ({
                                                ...prev,
                                                damageLevelMode: 'simple',
                                                grid: generateInitialGrid(mapVisual(prev.name)),
                                            }));
                                        } else {
                                            setEditedPart(prev => ({
                                                ...prev,
                                                damageLevelMode: 'grid',
                                                damageLevel: 0,
                                            }));
                                        }
                                    }}
                                    appearance="subtle"
                                >
                                    <Tabs.Tab eventKey="simple" title={str("Quick Select")}>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '12px 0' }}>
                                            {DAMAGE_LEVELS.map(({ value, label, color }) => {
                                                const isActive = editedPart.damageLevel === value;
                                                return (
                                                    <button
                                                        key={value}
                                                        onClick={() => setEditedPart(prev => ({ ...prev, damageLevel: value }))}
                                                        style={{
                                                            flex: '1 1 auto',
                                                            minWidth: '60px',
                                                            padding: '10px 12px',
                                                            borderRadius: '6px',
                                                            border: isActive ? `2px solid ${color}` : '2px solid #ddd',
                                                            backgroundColor: isActive ? color : '#fafafa',
                                                            color: isActive ? '#fff' : '#333',
                                                            fontWeight: isActive ? 'bold' : 'normal',
                                                            cursor: 'pointer',
                                                            textAlign: 'center',
                                                            fontSize: '13px',
                                                            transition: 'all 0.15s ease',
                                                        }}
                                                    >
                                                        <div>{str(label)}</div>
                                                        <div style={{ fontSize: '11px', opacity: 0.8, marginTop: '2px' }}>{value}</div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </Tabs.Tab>
                                    <Tabs.Tab eventKey="grid" title={str("Damage Map")}>
                                        <div style={{ padding: '12px 0' }}>
                                            {editedPart.grid && editedPart.grid.length > 0 ? (
                                                <GridDraw
                                                    gridData={editedPart.grid}
                                                    visual={mapVisual(editedPart.name)}
                                                    onGridChange={(newGrid) => setEditedPart(prev => ({ ...prev, grid: newGrid }))}
                                                />
                                            ) : (
                                                <Message type="info">
                                                    {str("No additional information available")}
                                                </Message>
                                            )}
                                        </div>
                                    </Tabs.Tab>
                                </Tabs>
                            </div>
                            )}

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