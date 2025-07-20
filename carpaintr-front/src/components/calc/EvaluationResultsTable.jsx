import React, { useState } from 'react';
import { Message, InlineEdit, Panel, Stack } from 'rsuite';
import './EvaluationResultsTable.css';

export const EvaluationResultsTable = ({ data, prices = {} }) => {
  const [priceState, setPriceState] = useState({ ...prices });

  const handlePriceChange = (name, value) => {
    setPriceState((prev) => ({ ...prev, [name]: parseFloat(value) || 0 }));
  };

  if (!Array.isArray(data)) {
    return (
      <Message type="error" showIcon>
        Invalid data: expected an array.
      </Message>
    );
  }

  return (
    <Stack direction="column" spacing={20}>
      {data.map((entry, index) => {
        if (!entry || typeof entry !== 'object') {
          return (
            <Message key={index} type="error" showIcon>
              Invalid entry at index {index}
            </Message>
          );
        }

        if (!entry.result) {
          return (
            <Message key={index} type="error" showIcon>
              {entry.text || 'Unknown error'}
            </Message>
          );
        }

        return (
          <Panel key={index} bordered header={`Result #${index + 1}`}>
            <table className="evaluation-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Estimation</th>
                  <th>Price</th>
                  <th>Sum</th>
                </tr>
              </thead>
              <tbody>
                {entry.result.map((row, i) => {
                  const price = priceState[row.name] ?? 1;
                  const sum = (row.estimation * price).toFixed(2);

                  return (
                    <tr key={i}>
                      <td title={row.tooltip || ''}>{row.name}</td>
                      <td>{row.estimation}</td>
                      <td>
                        <InlineEdit
                          defaultValue={price}
                          onChange={(value) => handlePriceChange(row.name, value)}
                          style={{ minWidth: 60 }}
                        />
                      </td>
                      <td>{sum}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Panel>
        );
      })}
    </Stack>
  );
};
