import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Drawer, Button, Input, Table, Dropdown, IconButton, FlexboxGrid, Panel } from 'rsuite';
import { Filter, X } from 'lucide-react';
import Papa from 'papaparse';
import _ from 'lodash';

const { Column, HeaderCell, Cell } = Table;

const TableEditorClaude = ({ 
  isOpen, 
  onClose,
  csvData, 
  fileName, 
  onSave 
}) => {
  const [data, setData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [filters, setFilters] = useState({});
  const [filteredData, setFilteredData] = useState([]);
  const inputRef = useRef(null);
  const tableRef = useRef(null);

  // Parse CSV data when it changes
  useEffect(() => {
    if (csvData && isOpen) {
      const parsed = Papa.parse(csvData, {
        header: false,
        skipEmptyLines: true,
        dynamicTyping: false
      });
      
      if (parsed.data && parsed.data.length > 0) {
        const [headerRow, ...dataRows] = parsed.data;
        setHeaders(headerRow.map(h => String(h).trim()));
        
        const processedData = dataRows.map((row, index) => {
          const rowObj = { _id: index };
          headerRow.forEach((header, colIndex) => {
            rowObj[String(header).trim()] = String(row[colIndex] || '');
          });
          return rowObj;
        });
        
        setData(processedData);
        setFilters({});
      }
    }
  }, [csvData, isOpen]);

  // Apply filters
  useEffect(() => {
    if (data.length === 0) {
      setFilteredData([]);
      return;
    }

    let filtered = [...data];
    
    Object.entries(filters).forEach(([column, filterValue]) => {
      if (filterValue && filterValue.trim()) {
        filtered = filtered.filter(row => {
          const cellValue = String(row[column] || '').toLowerCase();
          return cellValue.includes(filterValue.toLowerCase());
        });
      }
    });
    
    setFilteredData(filtered);
  }, [data, filters]);

  // Focus input when editing starts
  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

  const handleCellClick = useCallback((rowIndex, column) => {
    const actualRow = filteredData[rowIndex];
    if (!actualRow) return;
    
    setEditingCell({ rowIndex, column });
    setEditValue(String(actualRow[column] || ''));
  }, [filteredData]);

  const handleCellSave = useCallback(() => {
    if (!editingCell) return;
    
    const { rowIndex, column } = editingCell;
    const actualRow = filteredData[rowIndex];
    if (!actualRow) return;

    setData(prevData => 
      prevData.map(row => 
        row._id === actualRow._id 
          ? { ...row, [column]: editValue }
          : row
      )
    );
    
    setEditingCell(null);
    setEditValue('');
  }, [editingCell, editValue, filteredData]);

  const handleCellCancel = useCallback(() => {
    setEditingCell(null);
    setEditValue('');
  }, []);

  const handleKeyDown = useCallback((e) => {
    if (!editingCell) return;

    const { rowIndex, column } = editingCell;
    const currentColIndex = headers.indexOf(column);

    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        handleCellSave();
        // Move to next row
        if (rowIndex < filteredData.length - 1) {
          setTimeout(() => handleCellClick(rowIndex + 1, column), 0);
        }
        break;
      case 'Tab':
        e.preventDefault();
        handleCellSave();
        // Move to next column
        if (e.shiftKey) {
          if (currentColIndex > 0) {
            setTimeout(() => handleCellClick(rowIndex, headers[currentColIndex - 1]), 0);
          }
        } else {
          if (currentColIndex < headers.length - 1) {
            setTimeout(() => handleCellClick(rowIndex, headers[currentColIndex + 1]), 0);
          }
        }
        break;
      case 'Escape':
        e.preventDefault();
        handleCellCancel();
        break;
      case 'ArrowUp':
        if (!e.shiftKey && !e.ctrlKey) {
          e.preventDefault();
          handleCellSave();
          if (rowIndex > 0) {
            setTimeout(() => handleCellClick(rowIndex - 1, column), 0);
          }
        }
        break;
      case 'ArrowDown':
        if (!e.shiftKey && !e.ctrlKey) {
          e.preventDefault();
          handleCellSave();
          if (rowIndex < filteredData.length - 1) {
            setTimeout(() => handleCellClick(rowIndex + 1, column), 0);
          }
        }
        break;
    }
  }, [editingCell, headers, filteredData, handleCellSave, handleCellCancel, handleCellClick]);

  const handleFilterChange = useCallback((column, value) => {
    setFilters(prev => ({
      ...prev,
      [column]: value
    }));
  }, []);

  const clearFilter = useCallback((column) => {
    setFilters(prev => {
      const newFilters = { ...prev };
      delete newFilters[column];
      return newFilters;
    });
  }, []);

  const getUniqueValues = useCallback((column) => {
    const values = data.map(row => String(row[column] || '')).filter(Boolean);
    return [...new Set(values)].sort().slice(0, 50); // Limit for performance
  }, [data]);

  const handleSave = useCallback(() => {
    if (editingCell) {
      handleCellSave();
    }
    
    // Convert data back to CSV
    const csvRows = [headers];
    data.forEach(row => {
      const csvRow = headers.map(header => String(row[header] || ''));
      csvRows.push(csvRow);
    });
    
    const csvString = Papa.unparse(csvRows);
    onSave(csvString);
    onClose();
  }, [data, headers, editingCell, handleCellSave, onSave, onClose]);

  const handleCancel = useCallback(() => {
    setEditingCell(null);
    setEditValue('');
    onClose();
  }, [onClose]);

  // Memoized cell renderer for performance
  const CellRenderer = useMemo(() => {
    return ({ rowData, dataKey, rowIndex }) => {
      const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.column === dataKey;
      const cellValue = String(rowData[dataKey] || '');
      
      if (isEditing) {
        return (
          <Input
            ref={inputRef}
            value={editValue}
            onChange={setEditValue}
            onKeyDown={handleKeyDown}
            onBlur={handleCellSave}
            size="sm"
            style={{ width: '100%', border: '2px solid #3498ff' }}
          />
        );
      }
      
      return (
        <div
          onClick={() => handleCellClick(rowIndex, dataKey)}
          style={{
            cursor: 'pointer',
            padding: '8px',
            minHeight: '32px',
            display: 'flex',
            alignItems: 'center',
            borderRadius: '3px'
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = '#f8f9fa';
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = 'transparent';
          }}
        >
          {cellValue}
        </div>
      );
    };
  }, [editingCell, editValue, handleKeyDown, handleCellSave, handleCellClick]);

  // Memoized header renderer
  const HeaderRenderer = useMemo(() => {
    return ({ children: columnName }) => {
      const hasFilter = filters[columnName];
      const uniqueValues = getUniqueValues(columnName);
      
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: 600 }}>{columnName}</span>
          <Dropdown
            title={<Filter size={14} />}
            placement="bottomStart"
            trigger="click"
          >
            <div style={{ padding: '8px', minWidth: '200px' }}>
              <Input
                placeholder={`Filter ${columnName}...`}
                value={filters[columnName] || ''}
                onChange={(value) => handleFilterChange(columnName, value)}
                size="sm"
              />
              {hasFilter && (
                <Button
                  size="xs"
                  color="red"
                  appearance="ghost"
                  onClick={() => clearFilter(columnName)}
                  style={{ marginTop: '4px' }}
                >
                  Clear filter
                </Button>
              )}
              <div style={{ marginTop: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                {uniqueValues.map(value => (
                  <div
                    key={value}
                    onClick={() => handleFilterChange(columnName, value)}
                    style={{
                      padding: '4px 8px',
                      cursor: 'pointer',
                      borderRadius: '3px',
                      fontSize: '12px'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = '#f0f0f0';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = 'transparent';
                    }}
                  >
                    {value}
                  </div>
                ))}
              </div>
            </div>
          </Dropdown>
          {hasFilter && (
            <IconButton
              size="xs"
              icon={<X size={12} />}
              onClick={() => clearFilter(columnName)} 
              style={{ 
                backgroundColor: '#ff6b6b', 
                color: 'white',
                width: '18px',
                height: '18px'
              }}
            />
          )}
        </div>
      );
    };
  }, [filters, getUniqueValues, handleFilterChange, clearFilter]);

  if (!isOpen) return null;

  return (
    <Drawer
      open={isOpen}
      onClose={handleCancel}
      size="full"
      backdrop="static"
    >
      <Drawer.Header>
        <Drawer.Title>Edit CSV: {fileName}</Drawer.Title>
        <Drawer.Actions>
          <Button onClick={handleCancel} appearance="subtle">
            Cancel
          </Button>
          <Button onClick={handleSave} appearance="primary">
            Save Changes
          </Button>
        </Drawer.Actions>
      </Drawer.Header>
      
      <Drawer.Body style={{ padding: 0 }}>
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Panel 
            bordered 
            style={{ 
              margin: '10px', 
              marginBottom: '5px',
              backgroundColor: '#f8f9fa',
              border: '1px solid #dee2e6'
            }}
          >
            <FlexboxGrid justify="space-between" align="middle">
              <FlexboxGrid.Item>
                <strong>Rows:</strong> {filteredData.length} 
                {Object.keys(filters).length > 0 && (
                  <span style={{ color: '#666', marginLeft: '8px' }}>
                    (filtered from {data.length})
                  </span>
                )}
              </FlexboxGrid.Item>
              <FlexboxGrid.Item>
                <strong>Columns:</strong> {headers.length}
              </FlexboxGrid.Item>
            </FlexboxGrid>
          </Panel>
          
          <div style={{ flex: 1, margin: '0 10px 10px 10px', overflow: 'hidden' }}>
            <Table
              ref={tableRef}
              data={filteredData}
              height={window.innerHeight - 200}
              virtualized
              bordered
              cellBordered
              headerHeight={60}
              rowHeight={40}
              style={{ fontSize: '14px' }}
            >
              {headers.map((header, index) => (
                <Column
                  key={`${header}-${index}`}
                  width={150}
                  flexGrow={1}
                  minWidth={100}
                  resizable
                  sortable={false}
                >
                  <HeaderCell>
                    <HeaderRenderer>{header}</HeaderRenderer>
                  </HeaderCell>
                  <Cell dataKey={header}>
                    <CellRenderer />
                  </Cell>
                </Column>
              ))}
            </Table>
          </div>
        </div>
      </Drawer.Body>
    </Drawer>
  );
};

export default TableEditorClaude;