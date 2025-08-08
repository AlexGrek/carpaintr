import React, { useState } from 'react';
import { Message, InlineEdit, Panel, Stack } from 'rsuite';
import './EvaluationResultsTable.css';
import Trans from '../../localization/Trans';
import { registerTranslations } from '../../localization/LocaleContext';

registerTranslations("ua", {
    "Name": "Найменування",
    "Estimation": "Оцінка",
    "Price": "Ціна",
    "Sum": "Сума",
    "Total": "Всього",
});


export const EvaluationResultsTable = ({ data, prices = {}, currency = "" }) => {
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
                        <Panel key={index} header={entry.name} style={{ width: "100%" }}>
                            <Message type="error" showIcon>
                                Invalid entry at index {index}
                            </Message>
                        </Panel>
                    );
                }

                if (!entry.result) {
                    return (
                        <Panel key={index} header={entry.name} style={{ width: "100%", padding: "0" }}>
                            <Message key={index} type="error" showIcon>
                                {entry.text || 'Unknown error'}
                            </Message>
                        </Panel>
                    );
                }

                return (
                    <div key={index} style={{ width: "100%", marginBottom: "12px" }}>
                        <h4>{entry.name}</h4>
                        <table className="evaluation-table modern">
                            <thead>
                                <tr>
                                    <th style={{ width: '35px' }}>#</th>
                                    <th style={{ width: '90%' }}><Trans>Name</Trans></th>
                                    <th><Trans>Estimation</Trans></th>
                                    <th><Trans>Price</Trans> {currency && `(${currency})`}</th>
                                    <th><Trans>Sum</Trans> {currency && `(${currency})`}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {entry.result.map((row, i) => {
                                    const price = priceState[row.name] ?? 1;
                                    const sum = (row.estimation * price).toFixed(2);
                                    return (
                                        <tr key={i}>
                                            <td className='evaluation-table-cell-numeric'>{i + 1}</td>
                                            <td title={row.tooltip || ''}>{row.name}</td>
                                            <td className='evaluation-table-cell-numeric'>{row.estimation}</td>
                                            <td className='evaluation-table-cell-numeric'>
                                                <InlineEdit
                                                    defaultValue={price}
                                                    onChange={(value) => handlePriceChange(row.name, value)}
                                                    style={{ minWidth: 60 }}
                                                />
                                            </td>
                                            <td className='evaluation-table-cell-numeric'>{sum}</td>
                                        </tr>
                                    );
                                })}
                                <tr className="total-row">
                                    <td colSpan={4} style={{ textAlign: 'right', fontWeight: 'bold' }}><Trans>Total</Trans>:</td>
                                    <td><pre><b>
                                        {entry.result
                                            .reduce((acc, row) => {
                                                const price = priceState[row.name] ?? 1;
                                                return acc + row.estimation * price;
                                            }, 0)
                                            .toFixed(2)}
                                    </b> {currency}</pre>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                );
            })}
        </Stack>
    );
};
