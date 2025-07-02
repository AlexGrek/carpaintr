import React from 'react';
import PropTypes from 'prop-types';
import { Table } from 'rsuite';
import './CalculationTable.css';

const { Column, HeaderCell, Cell } = Table;

const CalculationTable = ({ name, calcFunction, calcData }) => {
  const data = calcFunction(calcData);

  const totalEstimation = data.reduce((sum, row) => sum + (row.estimation || 0), 0);
  const totalPrice = data.reduce((sum, row) => sum + (row.price || 0), 0);

  return (
    <div className="calculation-table-container">
      <h3 className="table-header">{name}</h3>
      <Table
        data={data}
        autoHeight
        bordered
        cellBordered
        className="calculation-table"
      >
        <Column width={80} align="center" fixed>
          <HeaderCell>#</HeaderCell>
          <Cell dataKey="number" >
            {(rowData, rowIndex) => rowIndex + 1}
          </Cell>
        </Column>

        <Column flexGrow={1} minWidth={200}>
          <HeaderCell>Operation</HeaderCell>
          <Cell dataKey="operation" />
        </Column>

        <Column width={120} align="right">
          <HeaderCell>Estimation</HeaderCell>
          <Cell dataKey="estimation" />
        </Column>

        <Column width={120} align="right">
          <HeaderCell>Price</HeaderCell>
          <Cell dataKey="price" />
        </Column>
      </Table>

      <div className="totals-row">
        <div className="totals-label">Total:</div>
        <div className="totals-estimation">{totalEstimation}</div>
        <div className="totals-price">{totalPrice}</div>
      </div>
    </div>
  );
};

CalculationTable.propTypes = {
  name: PropTypes.string.isRequired,
  calcFunction: PropTypes.func.isRequired,
  calcData: PropTypes.any.isRequired,
};

export default CalculationTable;
