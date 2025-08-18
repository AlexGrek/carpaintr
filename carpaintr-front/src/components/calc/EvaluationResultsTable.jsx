import React, { useCallback, useEffect, useState } from 'react';
import { Message, InlineEdit, Panel, Stack } from 'rsuite';
import './EvaluationResultsTable.css';
import Trans from '../../localization/Trans';
import { registerTranslations } from '../../localization/LocaleContext';
import { cloneDeep, isArrayLike, result } from 'lodash';

registerTranslations("ua", {
    "Name": "Найменування",
    "Estimation": "Оцінка",
    "Price": "Ціна",
    "Sum": "Сума",
    "Total": "Всього",
});


export const EvaluationResultsTable = ({ data, setData = null, prices = {}, currency = "", basePrice = 1 }) => {
    const [priceState, setPriceState] = useState({ ...prices });

    const getPrice = useCallback((name) => {
        let priceFromPrices = priceState[name];
        if (priceFromPrices == undefined) {
            return basePrice
        }
        else {
            return priceFromPrices
        }
    }, [basePrice, priceState]);

    const updateSums = useCallback(() => {
        if (setData && isArrayLike(data)) {
            if (!data.every(table => table.result.every((result) => result != undefined && result.sum != undefined))) {
                // need to pre-calculate everything
                let copy = cloneDeep(data);
                let upd = copy.map((table) => {
                    let acc = 0;
                    let updated_result = table.result.map((item) => {
                        if (item.sum == undefined) {
                            // console.log("-------------------------", item.name)
                            // console.log(item)
                            item.price = getPrice(item.name)
                            // console.log(item.price)
                            const sum = item.estimation * item.price;
                            acc += sum;
                            item.sum = (sum).toFixed(2)
                            // console.log(item.sum)
                        }
                        return item
                    })
                    return { ...table, result: updated_result, total: acc }
                })
                setData(upd)
            }
        }
    }, [data, getPrice, setData]);

    useEffect(() => {
        updateSums();
    }, [data, getPrice, setData, updateSums])

    const handlePriceChange = (name, value) => {
        setPriceState((prev) => ({ ...prev, [name]: parseFloat(value) || 0 }));
        if (setData) {
            let copy = cloneDeep(data)
            let item = copy.find(obj => obj.name === name);
            if (item) {
                item.price = value;
            }
        }
    }

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
                                    const price = priceState[row.name] ?? basePrice;
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
                                                const price = priceState[row.name] ?? basePrice;
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
