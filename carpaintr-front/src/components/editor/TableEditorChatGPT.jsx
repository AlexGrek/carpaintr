import React, { useState, useEffect, useCallback } from 'react';
import { Drawer, Button, Message, toaster } from 'rsuite';
import Papa from 'papaparse';
import { debounce } from 'lodash';
import CsvTableEditor from './CsvTableEditor';

// Helper to convert data array to CSV string
const convertToCsv = (data, headerRow) => {
    // Ensure headerRow is part of the data for PapaParse to correctly unparse
    const dataToUnparse = headerRow ? [headerRow, ...data] : data;
    return Papa.unparse(dataToUnparse);
};

const TableEditorChatGPT = ({
    show,
    onClose,
    csvString: initialCsvString,
    fileName = 'untitled.csv',
    onSave, // Function to call with updated CSV string
}) => {
    const [originalData, setOriginalData] = useState([]);
    const [headers, setHeaders] = useState([]);
    const [editedData, setEditedData] = useState([]);
    const [isDirty, setIsDirty] = useState(false);

    useEffect(() => {
        if (show && initialCsvString) {
            Papa.parse(initialCsvString, {
                header: false, // We'll handle headers manually to keep them as a separate row
                skipEmptyLines: true,
                complete: (results) => {
                    if (results.data.length > 0) {
                        setHeaders(results.data[0]); // First row is headers
                        setOriginalData(results.data.slice(1)); // Rest is data
                        setEditedData(results.data.slice(1)); // Initialize edited data
                    } else {
                        setHeaders([]);
                        setOriginalData([]);
                        setEditedData([]);
                    }
                    setIsDirty(false);
                },
                error: (error) => {
                    toaster.push(
                        <Message type="error" closable duration={5000}>
                            Error parsing CSV: {error.message}
                        </Message>,
                        { placement: 'topEnd' }
                    );
                    setHeaders([]);
                    setOriginalData([]);
                    setEditedData([]);
                    setIsDirty(false);
                },
            });
        }
    }, [show, initialCsvString]);

    // Debounce the setting of isDirty
    const debouncedSetIsDirty = useCallback(
        debounce((dirty) => {
            setIsDirty(dirty);
        }, 300), // Adjust debounce time as needed
        []
    );

    const handleDataChange = useCallback(
        (updatedRows) => {
            setEditedData(updatedRows);
            debouncedSetIsDirty(true);
        },
        [debouncedSetIsDirty]
    );

    const handleSave = () => {
        const finalCsvString = convertToCsv(editedData, headers);
        onSave(finalCsvString);
        setIsDirty(false); // Mark as clean after saving
        onClose(); // Close the drawer after saving
        toaster.push(
            <Message type="success" closable duration={3000}>
                CSV saved successfully!
            </Message>,
            { placement: 'topEnd' }
        );
    };

    const handleCancel = () => {
        if (isDirty) {
            // Optional: Ask for confirmation if changes are unsaved
            if (window.confirm('You have unsaved changes. Are you sure you want to close without saving?')) {
                onClose();
            }
        } else {
            onClose();
        }
    };

    return (
        <Drawer size="full" placement="right" open={show} onClose={handleCancel}>
            <Drawer.Header>
                <Drawer.Title>Edit CSV: {fileName}</Drawer.Title>
            </Drawer.Header>
            <Drawer.Body style={{ padding: 0 }}>
                {headers.length > 0 && (
                    <CsvTableEditor
                        data={editedData}
                        headers={headers}
                        onDataChange={handleDataChange}
                    />
                )}
                {headers.length === 0 && originalData.length === 0 && initialCsvString && (
                    <Message type="info" style={{ margin: 20 }}>
                        No data found in the CSV string.
                    </Message>
                )}
            </Drawer.Body>
            <Drawer.Footer>
                <Button onClick={handleSave} appearance="primary" disabled={!isDirty}>
                    Save
                </Button>
                <Button onClick={handleCancel} appearance="subtle">
                    Cancel
                </Button>
            </Drawer.Footer>
        </Drawer>
    );
};

export default TableEditorChatGPT;