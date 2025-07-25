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
        <Stack direction="column" spacing={20} alignItems='stretch'>
            {data.map((entry, index) => {
                if (!entry || typeof entry !== 'object') {
                    return (
                        <Panel key={index} header={entry.name} style={{width: "100%"}}>
                            <Message type="error" showIcon>
                                Invalid entry at index {index}
                            </Message>
                        </Panel>
                    );
                }

                if (!entry.result) {
                    return (
                        <Panel key={index} header={entry.name} style={{width: "100%", padding: "0"}}>
                            <Message key={index} type="error" showIcon>
                                {entry.text || 'Unknown error'}
                            </Message>
                        </Panel>
                    );
                }

                return (
                    <Panel key={index} bordered header={entry.name} style={{width: "100%"}}>
                        <table className="evaluation-table modern">
                            <thead>
                                <tr>
                                    <th style={{ width: '40px' }}>#</th>
                                    <th style={{ width: '100%' }}>Name</th>
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
                                            <td>{i + 1}</td>
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
                                <tr className="total-row">
                                    <td colSpan={4} style={{ textAlign: 'right', fontWeight: 'bold' }}>Total:</td>
                                    <td style={{ fontWeight: 'bold' }}>
                                        {entry.result
                                            .reduce((acc, row) => {
                                                const price = priceState[row.name] ?? 1;
                                                return acc + row.estimation * price;
                                            }, 0)
                                            .toFixed(2)}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </Panel>
                );
            })}
        </Stack>
    );
};
