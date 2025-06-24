import React, { useState, useEffect, useRef } from 'react';
import { Form, InlineEdit, Toggle, TagInput } from 'rsuite';

// Edits the fields of a single object (e.g., the properties of "fabia").
// It maintains an internal state and debounces the onChange callback.
const ItemEditor = ({ value, onChange }) => {
    const [internalData, setInternalData] = useState(value);
    const debounceTimeout = useRef(null);

    // Sync internal state if the external value prop changes (e.g., on "Cancel").
    useEffect(() => {
        setInternalData(value);
    }, [value]);
    
    // Cleanup the timeout on unmount
    useEffect(() => {
        return () => {
            if(debounceTimeout.current) {
                clearTimeout(debounceTimeout.current);
            }
        }
    }, []);
    
    const handleFieldChange = (key, newValue) => {
        const updatedData = { ...internalData, [key]: newValue };
        setInternalData(updatedData);

        // Debounce the onChange call
        if (debounceTimeout.current) {
            clearTimeout(debounceTimeout.current);
        }
        debounceTimeout.current = setTimeout(() => {
            onChange(updatedData);
        }, 1000);
    };

    const handleBlur = () => {
         // Propagate changes immediately on blur
         if (debounceTimeout.current) {
            clearTimeout(debounceTimeout.current);
        }
        onChange(internalData);
    }

    const renderFieldEditor = (key, val) => {
        const type = Array.isArray(val) ? 'array' : typeof val;
        let fieldTypeLabel = type;
        let editor = null;

        switch (type) {
            case 'string':
                editor = <InlineEdit value={val} onChange={newValue => handleFieldChange(key, newValue)} onBlur={handleBlur} />;
                break;
            case 'number':
                editor = (
                    <InlineEdit value={val} onBlur={handleBlur} onChange={newValue => {
                        const num = parseFloat(newValue);
                        handleFieldChange(key, isNaN(num) ? 0 : num);
                    }} />
                );
                break;
            case 'boolean':
                editor = <Toggle checked={val} onChange={checked => handleFieldChange(key, checked)} />;
                break;
            case 'array':
                if (val.every(item => typeof item === 'string')) {
                    fieldTypeLabel = 'array (string)';
                    editor = <TagInput value={val} trigger={['Enter', 'Comma', 'Space']} style={{ width: '100%' }} onBlur={handleBlur} onChange={newValue => handleFieldChange(key, newValue)} />;
                }
                break;
            default:
                // For unsupported types like objects or mixed arrays
                fieldTypeLabel = `unsupported (${type})`;
                editor = (
                    <div className="unsupported-field">
                       {JSON.stringify(val, null, 2)}
                    </div>
                );
        }

        return (
            <Form.Group key={key} onBlur={handleBlur}>
                <Form.ControlLabel>
                    {key}
                    <span className="field-type-label">{fieldTypeLabel}</span>
                </Form.ControlLabel>
                {editor}
            </Form.Group>
        );
    };

    return (
        <Form fluid>
            {Object.entries(internalData).map(([key, val]) => renderFieldEditor(key, val))}
        </Form>
    );
};

export default ItemEditor;
