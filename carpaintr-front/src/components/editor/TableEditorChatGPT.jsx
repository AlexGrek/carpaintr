import React, { useEffect, useMemo, useRef, useState } from 'react';
import Papa from 'papaparse';
import { Drawer, Button, Input, InputGroup, IconButton, Table } from 'rsuite';
import { Search } from '@rsuite/icons';

const { Column, HeaderCell, Cell } = Table;

const TableEditorChatGPT = ({ open, onClose, onSave, fileName, csvData }) => {
  const [data, setData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [editCell, setEditCell] = useState(null); // { row, column }
  const [filters, setFilters] = useState({});
  const [filteredData, setFilteredData] = useState([]);

  const tableRef = useRef(null);

  // Parse CSV on load
  useEffect(() => {
    if (!csvData) return;
    const { data: parsed } = Papa.parse(csvData, { header: true });
    setHeaders(Object.keys(parsed[0] || {}));
    setData(parsed);
    setFilters({});
  }, [csvData]);

  // Apply filters
  useEffect(() => {
    const filtered = data.filter(row =>
      Object.entries(filters).every(
        ([key, value]) => row[key]?.toLowerCase().includes(value.toLowerCase())
      )
    );
    setFilteredData(filtered);
  }, [data, filters]);

  const handleCellClick = (rowIndex, colKey) => {
    setEditCell({ row: rowIndex, column: colKey });
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

    if (e.key === 'Enter') {
      newRow = Math.min(row + 1, filteredData.length - 1);
    } else if (e.key === 'ArrowDown') {
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
    const nextRowIndex = data.findIndex((r) => r === filteredData[newRow]);
    setEditCell({ row: nextRowIndex, column: headers[newColIndex] });
  };

  const handleFilterChange = (header, value) => {
    setFilters(prev => ({ ...prev, [header]: value }));
  };

  const handleSave = () => {
    const csv = Papa.unparse(data);
    onSave(csv);
    onClose();
  };

  const renderCell = (rowData, rowIndex, colKey) => {
    if (editCell?.row === rowIndex && editCell?.column === colKey) {
      return (
        <Input
          autoFocus
          defaultValue={rowData[colKey]}
          onBlur={(e) => handleCellChange(rowIndex, colKey, e.target.value)}
          onKeyDown={handleKeyDown}
        />
      );
    }
    return (
      <div
        tabIndex={0}
        style={{ cursor: 'pointer' }}
        onClick={() => handleCellClick(rowIndex, colKey)}
      >
        {rowData[colKey]}
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
        <Table
          ref={tableRef}
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
                    <Input
                      placeholder="Filter"
                      value={filters[header] || ''}
                      onChange={(val) => handleFilterChange(header, val)}
                    />
                    <InputGroup.Addon>
                      <Search />
                    </InputGroup.Addon>
                  </InputGroup>
                </div>
              </HeaderCell>
              <Cell>
                {(rowData, rowIndex) => renderCell(rowData, data.indexOf(rowData), header)}
              </Cell>
            </Column>
          ))}
        </Table>
      </Drawer.Body>
    </Drawer>
  );
};

export default TableEditorChatGPT;