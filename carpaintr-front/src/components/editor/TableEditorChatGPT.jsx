import React, { useEffect, useState } from 'react';
import Papa from 'papaparse';
import './TableEditorChatGPT.css';
import { Drawer, Button, InputGroup, Dropdown, Table, Whisper, Popover, IconButton } from 'rsuite';
import { Search, More } from '@rsuite/icons';

const { Column, HeaderCell, Cell } = Table;

const TableEditorChatGPT = ({ open, onClose, onSave, fileName, csvData }) => {
  const [data, setData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [editCell, setEditCell] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [filters, setFilters] = useState({});
  const [filteredData, setFilteredData] = useState([]);

  useEffect(() => {
    if (!csvData) return;
    const { data: parsed } = Papa.parse(csvData, { header: true });
    setHeaders(Object.keys(parsed[0] || {}));
    setData(parsed);
    setFilters({});
  }, [csvData]);

  useEffect(() => {
    const filtered = data.filter(row =>
      Object.entries(filters).every(
        ([key, value]) => row[key]?.toLowerCase().includes(value.toLowerCase())
      )
    );
    setFilteredData(filtered);
  }, [data, filters]);

  const handleCellClick = (rowIndex, colKey) => {
    if (editCell) {
      handleCellChange(editCell.row, editCell.column, editValue);
    }
    setEditCell({ row: rowIndex, column: colKey });
    setEditValue(data[rowIndex][colKey] || '');
  };

  const handleCellChange = (rowIndex, colKey, value) => {
    const newData = [...data];
    newData[rowIndex][colKey] = value;
    setData(newData);
  };

  const handleKeyDown = (e) => {
    if (!editCell) return;
    const { row, column } = editCell;
    const colIndex = headers.indexOf(column);
    let newRow = row;
    let newColIndex = colIndex;

    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      newRow = Math.min(row + 1, filteredData.length - 1);
    } else if (e.key === 'ArrowUp') {
      newRow = Math.max(row - 1, 0);
    } else if (e.key === 'ArrowLeft') {
      newColIndex = Math.max(colIndex - 1, 0);
    } else if (e.key === 'ArrowRight') {
      newColIndex = Math.min(colIndex + 1, headers.length - 1);
    } else {
      return;
    }

    e.preventDefault();
    handleCellChange(editCell.row, editCell.column, editValue);
    const nextRowIndex = data.findIndex((r) => r === filteredData[newRow]);
    setEditCell({ row: nextRowIndex, column: headers[newColIndex] });
    setEditValue(data[nextRowIndex][headers[newColIndex]] || '');
  };

  const handleFilterChange = (header, value) => {
    setFilters(prev => ({ ...prev, [header]: value }));
  };

  const handleSave = () => {
    if (editCell) {
      handleCellChange(editCell.row, editCell.column, editValue);
    }
    const csv = Papa.unparse(data);
    onSave(csv);
    onClose();
  };

  const addRow = (index, duplicate = false) => {
    const newData = [...data];
    const newRow = duplicate ? { ...data[index] } : Object.fromEntries(headers.map(h => [h, '']));
    newData.splice(index, 0, newRow);
    setData(newData);
  };

  const addColumn = () => {
    const newCol = prompt('Enter new column name');
    if (!newCol || headers.includes(newCol)) return;
    const newHeaders = [...headers, newCol];
    const newData = data.map(row => ({ ...row, [newCol]: '' }));
    setHeaders(newHeaders);
    setData(newData);
  };

  const renderEditPopover = (rowIndex) => (
    <Popover full>
      <Dropdown.Menu>
        <Dropdown.Item onClick={() => addRow(rowIndex)}>Add Row Above</Dropdown.Item>
        <Dropdown.Item onClick={() => addRow(rowIndex + 1)}>Add Row Below</Dropdown.Item>
        <Dropdown.Item onClick={() => addRow(rowIndex + 1, true)}>Duplicate Row</Dropdown.Item>
      </Dropdown.Menu>
    </Popover>
  );

  const renderCell = (rowData, rowIndex, colKey) => {
    const absoluteRowIndex = data.indexOf(rowData);
    const cellContent = rowData[colKey];
    const isEditing = editCell?.row === absoluteRowIndex && editCell?.column === colKey;

    if (isEditing) {
      return (
        <div className="cell-edit-wrapper">
          <input
            className="cell-input"
            value={editValue}
            autoFocus
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={() => {
              handleCellChange(absoluteRowIndex, colKey, editValue);
              setEditCell(null);
            }}
            onKeyDown={handleKeyDown}
          />
          <Whisper placement="bottomEnd" trigger="click" speaker={renderEditPopover(absoluteRowIndex)}>
            <IconButton icon={<More />} size="xs" appearance="subtle" />
          </Whisper>
        </div>
      );
    }

    return (
      <div
        className={`cell-display ${!cellContent ? 'cell-empty' : ''}`}
        onClick={() => handleCellClick(absoluteRowIndex, colKey)}
      >
        {cellContent || <span className="cell-placeholder">+ Click to Edit</span>}
      </div>
    );
  };

  return (
    <Drawer open={open} onClose={onClose} size="full">
      <Drawer.Header>
        <Drawer.Title>Edit CSV: {fileName}</Drawer.Title>
        <Drawer.Actions>
          <Button onClick={onClose} appearance="subtle">Cancel</Button>
          <Button onClick={handleSave} appearance="primary">Save</Button>
        </Drawer.Actions>
      </Drawer.Header>
      <Drawer.Body>
        <Button appearance="ghost" onClick={addColumn} style={{ marginBottom: 10 }}>+ Add New Column</Button>
        <Table
          height={600}
          data={filteredData}
          virtualized
          rowHeight={40}
          headerHeight={70}
        >
          {headers.map(header => (
            <Column key={header} width={150} resizable>
              <HeaderCell>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <strong>{header}</strong>
                  <InputGroup size="xs">
                    <input
                      className="filter-input"
                      placeholder="Filter"
                      value={filters[header] || ''}
                      onChange={(e) => handleFilterChange(header, e.target.value)}
                    />
                    <InputGroup.Addon>
                      <Search />
                    </InputGroup.Addon>
                  </InputGroup>
                </div>
              </HeaderCell>
              <Cell>
                {(rowData, rowIndex) => renderCell(rowData, rowIndex, header)}
              </Cell>
            </Column>
          ))}
        </Table>
      </Drawer.Body>
    </Drawer>
  );
};

export default TableEditorChatGPT;
