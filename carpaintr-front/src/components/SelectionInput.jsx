import React, { useEffect } from "react";
import { Button, IconButton, HStack, Loader, Message, SelectPicker } from "rsuite";
import GridIcon from '@rsuite/icons/Grid';
import "./SelectionInput.css";
import isArray from 'lodash/isArray';

const SelectionInput = ({ values = [], selectedValue, onChange, name, autoConfirm = true, labels = null, labelFunction = null, mode="bubbles" }) => {
    const handleSelect = (value) => {
        if (onChange) onChange(value);
    };

    useEffect(() => {
        if (!isArray(values)) {
            console.error(values);
        }
        if (values.length === 1 && autoConfirm) {
            onChange(values[0])
        }
    }, [autoConfirm, onChange, values])

    const handleEdit = () => {
        if (onChange) onChange(null);
    };

    const getLabel = (item) => {
        if (labels == null || !labels[item]) {
            if (labelFunction != null) {
                return labelFunction(item)
            } else {
                return item
            }
        } else {
            return labels[item]
        }
    }
    if (mode === "bubbles")
    return (
        <HStack wrap className="selection-input">
            {name && <span>{name}:</span>}
            {!selectedValue ? (
                <div className="button-container">
                    {
                        isArray(values) ? <>
                            {values.length === 0 ? <Loader /> : values.map((value, index) => (
                                <Button
                                    key={value}
                                    appearance="primary"
                                    className="fade-in-selection"
                                    style={{ animationDelay: `${index * 0.02}s` }} // Staggered animation
                                    onClick={() => handleSelect(value)}
                                >
                                    {getLabel(value)}
                                </Button>
                            ))}
                        </> : <Message type="error">Not a list of values: {JSON.stringify(values)}</Message>
                    }
                </div>
            ) : (
                <div className="selected-value-container">
                    <span>{getLabel(selectedValue)}</span>
                    <IconButton className="fade-in-selection" icon={<GridIcon />} appearance="subtle" onClick={handleEdit} />
                </div>
            )}
        </HStack>
    );

    if (mode === "select") {
        const data = values.map(item => {
            return {
                label: getLabel(item),
                value: item
            }
        })
        return <SelectPicker style={{minWidth: "100pt"}} placeholder={name} value={selectedValue} data={data} onChange={handleSelect} searchable={data.length > 4}/>
    }

    return <div/>
};

export default SelectionInput;
