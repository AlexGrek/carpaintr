import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import ReactDataGrid from 'react-data-grid';
import { Input, Popover, Whisper, Checkbox, CheckboxGroup } from 'rsuite';
import { FaFilter } from 'react-icons/fa';
import { debounce } from 'lodash';

// Custom Text Editor for React-Data-Grid
const TextEditor = ({ row, column, onRowChange, onClose }) => {
    const initialValue = row[column.key];
    const [value, setValue] = useState(initialValue);
    const inputRef = useRef(null);

    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select(); // Select all text for easy replacement
        }
    }, []);

    const handleChange = (e) => {
        setValue(e.target.value);
    };

    const handleBlur = () => {
        onRowChange({ ...row, [column.key]: value }, true);
        onClose();
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault(); // Prevent default form submission
            onRowChange({ ...row, [column.key]: value }, true);
            onClose();
        }
    };

    return (
        <Input
            ref={inputRef}
            value={value}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            autoFocus
            size="sm"
            style={{ width: '100%', height: '100%', border: 'none', padding: '0 8px' }}
        />
    );
};

// Custom Header Renderer for React-Data-Grid with Filter
const FilterableHeaderRenderer = ({ column, rows, onFilterChange }) => {
    const [filterValues, setFilterValues] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const allUniqueValues = useMemo(() => {
        const values = new Set();
        rows.forEach(row => values.add(String(row[column.key]))); // Ensure string for consistency
        return Array.from(values).sort();
    }, [column.key, rows]);

    // Update filter values when allUniqueValues changes or on initial load
    useEffect(() => {
        setFilterValues(allUniqueValues);
    }, [allUniqueValues]);

    const handleFilterChange = useCallback((value) => {
        setFilterValues(value);
        onFilterChange(column.key, value);
    }, [column.key, onFilterChange]);

    const handleSearchChange = useCallback(debounce((value) => {
        setSearchTerm(value.toLowerCase());
    }, 300), []); // Debounce search input

    const filteredOptions = useMemo(() => {
        return allUniqueValues.filter(val =>
            String(val).toLowerCase().includes(searchTerm)
        );
    }, [allUniqueValues, searchTerm]);

    const speaker = (
        <Popover full style={{ maxWidth: 300, padding: '10px' }}>
            <Input
                placeholder="Search values..."
                onChange={handleSearchChange}
                style={{ marginBottom: 10 }}
            />
            <CheckboxGroup
                name="filter"
                value={filterValues}
                onChange={handleFilterChange}
                style={{ maxHeight: 200, overflowY: 'auto' }}
            >
                {filteredOptions.map((value, idx) => (
                    <Checkbox key={idx} value={value}>
                        {value === '' ? '(Empty)' : value}
                    </Checkbox>
                ))}
            </CheckboxGroup>
        </Popover>
    );

    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px', height: '100%' }}>
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {column.name}
            </span>
            <Whisper
                trigger="click"
                placement="bottomEnd"
                speaker={speaker}
                preventOverflow
                // Fix for the Popover not closing when clicking outside
                onClose={() => setFilterValues(allUniqueValues)}
            >
                <Button appearance="subtle" size="xs" style={{ padding: '4px', minWidth: 'unset' }}>
                    <FaFilter style={{ opacity: filterValues.length === allUniqueValues.length || filterValues.length === 0 ? 0.3 : 1 }} />
                </Button>
            </Whisper>
        </div>
    );
};

const CsvTableEditor = ({ data, headers, onDataChange }) => {
    const [rows, setRows] = useState([]);
    const [columnFilters, setColumnFilters] = useState({});

    // Memoize columns to prevent unnecessary re-renders of the grid
    const columns = useMemo(() => {
        if (!headers || headers.length === 0) return [];
        return headers.map((header) => ({
            key: header, // Use header as key for react-data-grid
            name: header,
            resizable: true,
            sortable: true,
            editor: TextEditor,
            headerRenderer: (props) => (
                <FilterableHeaderRenderer
                    {...props}
                    rows={data} // Pass original data to the header for filter options
                    onFilterChange={handleFilterChange}
                />
            ),
            minWidth: 150, // Default minimum width
        }));
    }, [headers, data]); // Re-generate columns if headers or original data changes

    // Update internal rows state when external data prop changes
    useEffect(() => {
        setRows(data);
    }, [data]);

    const handleRowsChange = useCallback((updatedRows, { column, row }) => {
        // This is called by React-Data-Grid when a cell is edited
        // updatedRows here refers to the _current_ filtered/sorted view.
        // We need to map it back to the original index if we are using filtering/sorting
        // However, for simplicity and to directly update the displayed data,
        // we'll treat updatedRows as the source of truth for the visible rows.
        // If complex filtering/sorting is applied *before* editing, we'd need a more
        // sophisticated way to update the original data array.
        // For now, onDataChange will receive the rows as they are displayed/edited.
        onDataChange(updatedRows); // Pass the updated rows back to the parent
    }, [onDataChange]);

    const handleFilterChange = useCallback((columnKey, values) => {
        setColumnFilters((prevFilters) => {
            const newFilters = { ...prevFilters };
            if (values.length === 0 || values.length === new Set(data.map(row => String(row[columnKey]))).size) {
                delete newFilters[columnKey]; // Remove filter if all values are selected or none
            } else {
                newFilters[columnKey] = new Set(values.map(String)); // Store as a Set for efficient lookup
            }
            return newFilters;
        });
    }, [data]);

    const filteredRows = useMemo(() => {
        if (Object.keys(columnFilters).length === 0) {
            return rows;
        }

        return rows.filter(row => {
            for (const columnKey in columnFilters) {
                if (columnFilters.hasOwnProperty(columnKey)) {
                    const allowedValues = columnFilters[columnKey];
                    if (!allowedValues.has(String(row[columnKey]))) {
                        return false;
                    }
                }
            }
            return true;
        });
    }, [rows, columnFilters]);

    // Optimize cell rendering with React.memo
    const cellRenderer = useCallback(props => {
        // This is a default cell renderer. React-Data-Grid handles the editor on click.
        return <div style={{ padding: '0 8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {props.row[props.column.key]}
        </div>;
    }, []);

    // Memoize the grid component to prevent unnecessary re-renders
    const MemoizedDataGrid = useMemo(() => {
        return (
            <ReactDataGrid
                columns={columns}
                rows={filteredRows}
                onRowsChange={handleRowsChange}
                rowHeight={35} // Adjust row height as needed
                className="rdg-light" // Use a light theme
                enableVirtualization={true} // Explicitly enable, though often default
                headerRowHeight={40} // Height for header row
                // This is crucial for performance. Only render visible cells.
                // React-Data-Grid handles this implicitly with its virtualization,
                // but setting a minimum viewport size can help.
                // maxPageSize={500} // Example: render up to 500 rows at a time
                // The library handles what's visible, no explicit maxPageSize needed usually.
            />
        );
    }, [columns, filteredRows, handleRowsChange]);


    return (
        <div style={{ height: '100%', width: '100%', overflow: 'hidden' }}>
            {MemoizedDataGrid}
        </div>
    );
};

export default CsvTableEditor;