
import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import PropTypes from 'prop-types';
import { Message, Drawer, Modal, Button, Loader } from 'rsuite';
import { useMediaQuery } from 'react-responsive';
import {
    Check, X, Trash2, Bug, ChevronRight, Car, Settings2, SlidersHorizontal, MousePointerClick,
    Gauge, Wrench, CircleAlert, LoaderCircle, TriangleAlert, Braces,
} from 'lucide-react';
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
import GridDraw from './GridDraw';
import SegmentedControl from '../layout/SegmentedControl';
import { EvaluationResultsTable } from './EvaluationResultsTable';
import { normPriceOf, toRealNumber, withDefaultPrices } from '../../calc/collapseTables';
import { PartDebugPanel, TechDataPanel } from './CarBodyMainDebug';
import { stripExt } from '../../utils/utils';
import './CarBodyMain.css';

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
    "tables": "tables",
    "total": "total",
    "nothing": "nothing",
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
    "Loading car parts...": "Loading car parts...",
    "Available": "Available",
    "Selected": "Selected",
    "Unavailable": "Unavailable",
    "No action selected": "No action selected",
    "No parts selected yet": "No parts selected yet",
    "Tap a body zone on the diagram to add a damaged part": "Tap a body zone on the diagram to add a damaged part",
    "No calculations yet for this part": "No calculations yet for this part",
    "Choose action": "Choose action",
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
    "tables": "табл.",
    "total": "разом",
    "nothing": "немає даних",
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
    "Required table \"%s\" not found. Available: [%s]": "Обов'язкова таблиця \"%s\" не знайдена. Доступні: [%s]",
    "Table \"%s\" loaded but data is null — server returned no rows. Required: [%s]": "Таблиця \"%s\" завантажена, але дані порожні — сервер не повернув рядків. Обов'язкові: [%s]",
    "Loading car parts...": "Завантаження деталей авто...",
    "Available": "Доступно",
    "Selected": "Обрано",
    "Unavailable": "Недоступно",
    "No action selected": "Дію не обрано",
    "No parts selected yet": "Деталі ще не обрано",
    "Tap a body zone on the diagram to add a damaged part": "Натисніть на зону кузова на схемі, щоб додати пошкоджену деталь",
    "No calculations yet for this part": "Для цієї деталі ще немає розрахунків",
    "Choose action": "Обрати дію",
});

const DAMAGE_LEVELS = [
    { value: 0, label: "None", color: "#94a3b8", pill: "bg-slate-100 text-slate-600" },
    { value: 2, label: "Light", color: "#eab308", pill: "bg-yellow-100 text-yellow-800" },
    { value: 5, label: "Medium", color: "#f97316", pill: "bg-orange-100 text-orange-800" },
    { value: 7, label: "Severe", color: "#ef4444", pill: "bg-red-100 text-red-700" },
    { value: 10, label: "Critical", color: "#a855f7", pill: "bg-purple-100 text-purple-700" },
];

const NEUTRAL_ACCENT = "#cbd5e1";
const GRID_ACCENT = "#f97316";
const DEFAULT_ACTIONS = ['assemble', 'twist', 'replace', 'mount', 'repair', 'paint'];

const DIAGRAM_LEGEND = [
    ["Available", "border-slate-300 bg-white"],
    ["Selected", "border-emerald-500 bg-emerald-50"],
    ["Unavailable", "border-dashed border-slate-300 bg-slate-100"],
];

const SectionLabel = ({ icon: Icon, children }) => (
    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
        <Icon size={14} className="text-slate-400" />
        {children}
    </div>
);

SectionLabel.propTypes = {
    icon: PropTypes.elementType.isRequired,
    children: PropTypes.node,
};

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
    const toTestIdValue = useCallback(
        (value) =>
            String(value)
                .toLowerCase()
                .replace(/\s+/g, "-")
                .replace(/[^a-z0-9-_]/g, ""),
        []
    );

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
    // True while T1/T2/processors are being (re)fetched for the current carClass+body.
    // Every diagram part looks identical whether it genuinely has no data for this body
    // type or the T2 fetch just hasn't resolved yet (buildCarSubcomponentsFromT2([]) is
    // indistinguishable from a real empty result) - this flag lets the UI tell them apart.
    const [isDiagramDataLoading, setIsDiagramDataLoading] = useState(true);
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
    const [collapsedParts, setCollapsedParts] = useState({});
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
            updates[item.name] = withDefaultPrices(results, normPriceOf(company));
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
        setIsDiagramDataLoading(true);

        // Fetch processors bundle
        const processorsPromise = fetchData(
            '/api/v1/user/processors_bundle',
            'Processors Bundle',
            (code) => {
                try {
                    const sandbox = { exports: {}, ...make_sandbox_extensions() };
                    new Function("exports", code)(sandbox.exports);
                    // The bundle arrives in filesystem read order, which is
                    // platform-dependent. Sort by orderingNum once, here, so
                    // every downstream consumer (evaluation results, collapsed
                    // and by-category views, print payload) sees the works in
                    // the sequence they are actually performed in.
                    const plugins = sandbox.exports.default
                        .map((p) => verify_processor(p))
                        .sort((a, b) => (a.orderingNum ?? 0) - (b.orderingNum ?? 0));
                    setProcessors(plugins);
                } catch (error) {
                    handleError('Processors Bundle Processing', error);
                }
            }
        );

        // Fetch car parts (T1)
        const t1Promise = fetchData(
            `/api/v1/user/carparts/${carClass}/${body}`,
            'Car Parts T1',
            (data) => setAvailableParts(data)
        );

        // Fetch car parts (T2)
        const t2Promise = fetchData(
            `/api/v1/user/carparts_t2/${carClass}/${body}`,
            'Car Parts T2',
            (data) => setAvailablePartsT2(data)
        );

        // fetchData swallows its own errors (routed to handleError), so this always
        // resolves - the diagram becomes interactive whether the fetches succeeded or not.
        Promise.all([processorsPromise, t1Promise, t2Promise]).then(() => {
            setIsDiagramDataLoading(false);
        });

    }, [body, carClass, handleError, fetchData]);

    const partSubComponents = useMemo(
        () => buildCarSubcomponentsFromT2(availablePartsT2),
        [availablePartsT2]
    );

    const basePrice = normPriceOf(company);
    const currency = company?.pricing_preferences?.norm_price?.currency ?? '';

    const partSummaries = useMemo(() => selectedItems.map((item) => {
        const calcData = calculations?.[item.name];
        const validTables = Array.isArray(calcData)
            ? calcData.filter(e => e && typeof e === 'object' && Array.isArray(e.result))
            : [];
        const total = validTables.reduce((acc, entry) =>
            acc + entry.result.reduce((a, row) => a + toRealNumber(row.estimation) * toRealNumber(row.price ?? basePrice), 0), 0);
        const gridFlat = item.grid ? item.grid.flat().filter(c => c !== -1) : [];
        const gridMarked = gridFlat.filter(c => c > 0).length;
        return {
            item,
            action: item.selectedAction || item.action,
            calcData,
            hasCalcData: Array.isArray(calcData) && calcData.length > 0,
            validTables,
            total,
            dmgLevel: DAMAGE_LEVELS.find(d => d.value === item.damageLevel),
            gridMarked,
            gridTotal: gridFlat.length,
        };
    }), [selectedItems, calculations, basePrice]);

    const grandTotal = partSummaries.reduce((acc, s) => acc + s.total, 0);

    // Per-part values from repair_types.csv so they match processor requiredRepairTypes
    // (Ukrainian names). Falls back to T2 action codes, then to the default list.
    const actionOptions = useMemo(() => {
        const partTableData = tableDataRepository[drawerPartDetails?.name];
        const repairTypesEntry = partTableData?.find(t => t.name === 'repair_types');
        const fromTable = (repairTypesEntry?.data?.['Ремонти'] || '')
            .split('/')
            .map(s => s.trim())
            .filter(Boolean);
        if (fromTable.length > 0) return fromTable.map(rt => ({ label: rt, value: rt }));
        const actions = drawerPartDetails?.actions?.length > 0 ? drawerPartDetails.actions : DEFAULT_ACTIONS;
        return actions.map(a => ({ label: str(a), value: a }));
    }, [tableDataRepository, drawerPartDetails, str]);

    const togglePart = useCallback((name) => {
        setCollapsedParts(prev => ({ ...prev, [name]: prev[name] === false }));
    }, []);

    const handleDamageModeChange = useCallback((mode) => {
        setEditedPart(prev => {
            if ((prev.damageLevelMode || 'simple') === mode) return prev;
            return mode === 'simple'
                ? { ...prev, damageLevelMode: 'simple', grid: generateInitialGrid(mapVisual(prev.name)) }
                : { ...prev, damageLevelMode: 'grid', damageLevel: 0 };
        });
    }, [generateInitialGrid, mapVisual]);

    const damageMode = editedPart?.damageLevelMode || 'simple';
    const showDamageSection = editedPart && editedPart.action !== 'replace' && editedPart.action !== 'mount';

    return (
        <div
            className={`w-full text-left ${className}`}
            style={{ ...style, maxWidth: '900px', margin: '0 auto', width: '100%' }}
        >
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                        <Car size={20} />
                    </div>
                    <div className="min-w-0 flex-1 leading-tight">
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                            {str("Car Body")}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="inline-block text-base font-semibold text-slate-900 first-letter:uppercase">
                                {str(body) || str('Unknown')}
                            </span>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                                {str("Class")} {carClass || 'N/A'}
                            </span>
                        </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                        <button
                            type="button"
                            onClick={() => setShowDebugMode(prev => !prev)}
                            data-testid="calc-body-debug-toggle-button"
                            className={`cbm-icon-btn cbm-icon-btn--subtle${showDebugMode ? ' is-active' : ''}`}
                            aria-pressed={showDebugMode}
                            title="Toggle evaluator debug mode"
                        >
                            <Bug size={16} />
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowTechData(prev => !prev)}
                            data-testid="calc-body-tech-data-toggle-button"
                            className={`cbm-icon-btn cbm-icon-btn--subtle${showTechData ? ' is-active' : ''}`}
                            aria-pressed={showTechData}
                            title="Toggle technical data"
                        >
                            <Settings2 size={16} />
                        </button>
                    </div>
                </div>

                <div className="p-3 sm:p-4">
                    {showTechData ? (
                        <TechDataPanel
                            errors={errors}
                            setErrors={setErrors}
                            body={body}
                            carClass={carClass}
                            selectedParts={selectedParts}
                            partsVisual={partsVisual}
                            company={company}
                            availableParts={availableParts}
                            availablePartsT2={availablePartsT2}
                            processors={processors}
                            calculations={calculations}
                            onChange={onChange}
                            setCalculations={setCalculations}
                        />
                    ) : (
                        <>
                            <div className="relative rounded-xl bg-slate-50 py-4">
                                <CarDiagram
                                    selectedItems={selectedItems}
                                    onSelect={handleDiagramSelect}
                                    partSubComponents={partSubComponents}
                                />
                                {isDiagramDataLoading && (
                                    <div
                                        data-testid="calc-car-diagram-loading"
                                        className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-white/70"
                                    >
                                        <Loader size="md" content={str("Loading car parts...")} />
                                    </div>
                                )}
                            </div>
                            <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-slate-500">
                                {DIAGRAM_LEGEND.map(([label, swatch]) => (
                                    <span key={label} className="inline-flex items-center gap-1.5">
                                        <span className={`h-3 w-3 rounded-[4px] border-[1.5px] ${swatch}`} />
                                        {str(label)}
                                    </span>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {!showTechData && (
                <div className="mt-6" data-testid="calc-body-selected-parts">
                    <div className="mb-3 flex items-end justify-between gap-3 px-1">
                        <div className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                            {str("Selected Parts")}
                            <span className="rounded-full bg-slate-900 px-2 text-xs font-semibold leading-5 text-white">
                                {selectedItems.length}
                            </span>
                        </div>
                        {selectedItems.length > 0 && (
                            <div className="text-right leading-tight">
                                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                    {str("Total")}
                                </div>
                                <div
                                    className="text-lg font-semibold tabular-nums text-slate-900"
                                    data-testid="calc-body-selected-parts-total"
                                >
                                    {grandTotal.toFixed(2)}{' '}
                                    <span className="text-sm font-medium text-slate-500">{currency}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {selectedItems.length === 0 ? (
                        <div
                            className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center"
                            data-testid="calc-body-selected-parts-empty"
                        >
                            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                                <MousePointerClick size={20} />
                            </div>
                            <div className="text-sm font-semibold text-slate-700">{str("No parts selected yet")}</div>
                            <div className="max-w-xs text-xs text-slate-500">
                                {str("Tap a body zone on the diagram to add a damaged part")}
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {partSummaries.map(({ item, action, calcData, hasCalcData, validTables, total, dmgLevel, gridMarked, gridTotal }) => {
                                const testId = toTestIdValue(item.name);
                                const fetchError = fetchErrors[item.name];
                                const isItemLoading = fetchingPartsRef.current.has(item.name) && !tableDataRepository[item.name] && !fetchError;
                                const isCollapsed = collapsedParts[item.name] !== false;
                                const isGridMode = item.damageLevelMode === 'grid';
                                const gridPct = gridTotal > 0 ? Math.round((gridMarked / gridTotal) * 100) : 0;
                                const accent = isGridMode
                                    ? (gridMarked > 0 ? GRID_ACCENT : NEUTRAL_ACCENT)
                                    : (dmgLevel?.value > 0 ? dmgLevel.color : NEUTRAL_ACCENT);

                                return (
                                    <div
                                        key={item.name}
                                        data-testid={`calc-body-part-item-${testId}`}
                                        className="relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md"
                                    >
                                        <span
                                            aria-hidden
                                            className="absolute inset-y-0 left-0 w-1"
                                            style={{ backgroundColor: accent }}
                                        />
                                        <div className="flex items-center gap-1 pr-2">
                                            <div
                                                role="button"
                                                tabIndex={0}
                                                aria-expanded={!isCollapsed}
                                                data-testid={`calc-body-part-toggle-${testId}`}
                                                className="flex min-w-0 flex-1 cursor-pointer select-none items-center gap-2 py-2.5 pl-3 sm:gap-3 sm:pl-4"
                                                onClick={() => togglePart(item.name)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' || e.key === ' ') {
                                                        e.preventDefault();
                                                        togglePart(item.name);
                                                    }
                                                }}
                                            >
                                                <ChevronRight
                                                    size={16}
                                                    className={`shrink-0 text-slate-400 transition-transform duration-200 ${isCollapsed ? '' : 'rotate-90'}`}
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <div className="break-words text-sm font-semibold leading-snug text-slate-900">
                                                        {item.name}
                                                    </div>
                                                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                                                        {action ? (
                                                            <span className="text-slate-500">{str(action)}</span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 font-medium text-amber-600">
                                                                <CircleAlert size={12} />
                                                                {str("No action selected")}
                                                            </span>
                                                        )}
                                                        {isGridMode ? (
                                                            gridMarked > 0 && (
                                                                <span className="rounded-full bg-orange-100 px-2 py-0.5 font-medium tabular-nums text-orange-800">
                                                                    {gridMarked}/{gridTotal} ({gridPct}%)
                                                                </span>
                                                            )
                                                        ) : (
                                                            dmgLevel?.value > 0 && (
                                                                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${dmgLevel.pill}`}>
                                                                    <span
                                                                        className="h-1.5 w-1.5 rounded-full"
                                                                        style={{ backgroundColor: dmgLevel.color }}
                                                                    />
                                                                    {str(dmgLevel.label)}
                                                                </span>
                                                            )
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="shrink-0 text-right leading-tight">
                                                    {fetchError ? (
                                                        <TriangleAlert size={16} className="text-red-500" />
                                                    ) : isItemLoading ? (
                                                        <LoaderCircle size={16} className="animate-spin text-slate-400" />
                                                    ) : validTables.length > 0 ? (
                                                        <>
                                                            <div className="text-sm font-semibold tabular-nums text-slate-900">
                                                                {total.toFixed(2)}{' '}
                                                                <span className="text-xs font-medium text-slate-400">{currency}</span>
                                                            </div>
                                                            <div className="text-[11px] text-slate-400">
                                                                {validTables.length} {str("tables")}
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <span className="text-xs italic text-slate-300">{str("nothing")}</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex shrink-0 items-center">
                                                <button
                                                    type="button"
                                                    className="cbm-icon-btn"
                                                    onClick={() => handleShowDetails(item)}
                                                    data-testid={`calc-body-part-details-button-${testId}`}
                                                    title={str("Details")}
                                                    aria-label={str("Details")}
                                                >
                                                    <SlidersHorizontal size={16} />
                                                </button>
                                                <button
                                                    type="button"
                                                    className="cbm-icon-btn cbm-icon-btn--danger"
                                                    onClick={() => handleRequestDelete(item)}
                                                    data-testid={`calc-body-part-remove-button-${testId}`}
                                                    title={str("Remove")}
                                                    aria-label={str("Remove")}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>

                                        {!isCollapsed && (
                                            <div className="overflow-x-auto border-t border-slate-100 bg-slate-50/70 px-3 py-3 sm:px-4">
                                                {fetchError ? (
                                                    <div>
                                                        <Message type="error" showIcon style={{ marginBottom: '6px' }}>
                                                            {str("Failed to load table data")} — {fetchError}
                                                        </Message>
                                                        <Button
                                                            size="xs"
                                                            appearance="ghost"
                                                            color="blue"
                                                            onClick={() => fetchTableDataForPart(item.name)}
                                                            data-testid={`calc-body-part-retry-button-${testId}`}
                                                        >
                                                            {str("Retry")}
                                                        </Button>
                                                    </div>
                                                ) : isItemLoading ? (
                                                    <div className="flex items-center gap-2 text-sm text-slate-400">
                                                        <LoaderCircle size={14} className="animate-spin" />
                                                        {str("Loading table data...")}
                                                    </div>
                                                ) : hasCalcData ? (
                                                    <EvaluationResultsTable
                                                        data={calcData}
                                                        setData={(newData) => setCalculations(prev => ({ ...prev, [item.name]: newData }))}
                                                        currency={currency}
                                                        basePrice={basePrice}
                                                        skipIncorrect={true}
                                                        getEditorUrl={getEditorUrl}
                                                    />
                                                ) : (
                                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                                        <span className="text-sm text-slate-500">
                                                            {str("No calculations yet for this part")}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            className="cbm-soft-btn"
                                                            onClick={() => handleShowDetails(item)}
                                                            data-testid={`calc-body-part-choose-action-button-${testId}`}
                                                        >
                                                            <SlidersHorizontal size={14} />
                                                            {str("Choose action")}
                                                        </button>
                                                    </div>
                                                )}
                                                <PartDebugPanel
                                                    logs={evaluatorLogs[item.name]}
                                                    open={!!partDebugOpen[item.name]}
                                                    onToggle={() => setPartDebugOpen(prev => ({ ...prev, [item.name]: !prev[item.name] }))}
                                                    getEditorUrl={getEditorUrl}
                                                />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Part Details Drawer */}
            <Drawer
                open={drawerOpen}
                onClose={handleDrawerSave}
                size={isMobile ? 'full' : 'sm'}
                className="cbm-drawer"
                data-testid="calc-body-part-details-drawer"
            >
                <Drawer.Header>
                    <Drawer.Title>
                        <div className="min-w-0 leading-tight">
                            <div className="truncate text-base font-semibold text-slate-900">
                                {drawerPartDetails?.name || str("Part Details")}
                            </div>
                            {(drawerPartDetails?.zone || drawerPartDetails?.group) && (
                                <div className="mt-0.5 truncate text-xs font-normal text-slate-500">
                                    {[drawerPartDetails.zone, drawerPartDetails.group].filter(Boolean).join(' · ')}
                                </div>
                            )}
                        </div>
                    </Drawer.Title>
                    <Drawer.Actions>
                        <Button
                            onClick={handleDrawerCancel}
                            appearance="subtle"
                            startIcon={<X size={18} />}
                            data-testid="calc-body-part-details-cancel-button"
                        >
                            {!isMobile && str("Cancel")}
                        </Button>
                        <Button
                            onClick={handleDrawerSave}
                            appearance="primary"
                            color="green"
                            startIcon={<Check size={18} />}
                            data-testid="calc-body-part-details-save-button"
                        >
                            {!isMobile && str("Save")}
                        </Button>
                    </Drawer.Actions>
                </Drawer.Header>
                <Drawer.Body>
                    {editedPart ? (
                        <div className="flex flex-col gap-7 text-left">
                            <section>
                                <SectionLabel icon={Wrench}>{str("Action")}</SectionLabel>
                                <div
                                    role="radiogroup"
                                    aria-label={str("Action")}
                                    data-testid="calc-body-part-action-picker"
                                    className="cbm-options mt-3"
                                >
                                    {actionOptions.map((opt) => {
                                        const isSelected = editedPart.action === opt.value;
                                        return (
                                            <button
                                                key={opt.value}
                                                type="button"
                                                role="radio"
                                                aria-checked={isSelected}
                                                className={`cbm-option${isSelected ? ' is-selected' : ''}`}
                                                onClick={() => setEditedPart(prev => ({ ...prev, action: opt.value }))}
                                                data-testid={`calc-body-part-action-picker-option-${opt.value}`}
                                            >
                                                <span className="cbm-option-radio" aria-hidden />
                                                <span>{opt.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </section>

                            {showDamageSection && (
                                <section>
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <SectionLabel icon={Gauge}>{str("Damage Level")}</SectionLabel>
                                        <SegmentedControl
                                            ariaLabel={str("Damage Level")}
                                            value={damageMode}
                                            onChange={handleDamageModeChange}
                                            options={[
                                                { value: 'simple', label: str("Quick Select"), testId: 'calc-body-part-damage-mode-simple' },
                                                { value: 'grid', label: str("Damage Map"), testId: 'calc-body-part-damage-mode-grid' },
                                            ]}
                                        />
                                    </div>

                                    {damageMode === 'simple' ? (
                                        <div className="cbm-levels mt-3">
                                            {DAMAGE_LEVELS.map(({ value, label, color }) => {
                                                const isActive = editedPart.damageLevel === value;
                                                return (
                                                    <button
                                                        key={value}
                                                        type="button"
                                                        aria-pressed={isActive}
                                                        className={`cbm-level${isActive ? ' is-active' : ''}`}
                                                        style={{ '--level-color': color }}
                                                        onClick={() => setEditedPart(prev => ({ ...prev, damageLevel: value }))}
                                                        data-testid={`calc-body-part-damage-level-${value}`}
                                                    >
                                                        <span className="cbm-level-dot" aria-hidden />
                                                        <span className="cbm-level-label">{str(label)}</span>
                                                        <span className="cbm-level-value">{value}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="mt-3">
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
                                    )}
                                </section>
                            )}

                            {showDebugMode && drawerPartDetails && (
                                <details className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                                    <summary className="cursor-pointer text-sm font-semibold text-slate-600">
                                        <Braces size={14} className="mr-1.5 inline-block align-[-2px]" />
                                        {str("Raw Data")}
                                    </summary>
                                    <pre className="mt-2 max-h-96 overflow-auto rounded-lg bg-white p-3 font-mono text-[11px]">
                                        {JSON.stringify({ original: drawerPartDetails, edited: editedPart }, null, 2)}
                                    </pre>
                                </details>
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
                data-testid="calc-body-part-delete-modal"
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
                    <Button
                        onClick={handleConfirmDelete}
                        appearance="primary"
                        color="red"
                        data-testid="calc-body-part-delete-confirm-button"
                    >
                        {str("Remove")}
                    </Button>
                    <Button
                        onClick={() => setDeleteConfirmOpen(false)}
                        appearance="subtle"
                        data-testid="calc-body-part-delete-cancel-button"
                    >
                        {str("Cancel")}
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
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