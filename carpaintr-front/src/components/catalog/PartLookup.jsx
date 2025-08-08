import { useCallback, useEffect, useState } from "react";
import { authFetch } from "../../utils/authFetch";
import ErrorMessage from "../layout/ErrorMessage";
import { Button, IconButton, Loader, Panel, Table } from "rsuite";
import { registerTranslations, useLocale } from "../../localization/LocaleContext";
import styled from 'styled-components';
import Trans from "../../localization/Trans";
import { ArrowDownLine } from '@rsuite/icons';

// Styled components for the table container if you want custom spacing/overflow behavior
const StyledTableContainer = styled.div`
  margin-bottom: 20px;
  overflow-x: auto; /* Ensures horizontal scrolling on small screens */
`;

registerTranslations('ua', {
    "Error": "Помилка",
    "Table": "Таблиця",
    "Unnamed Table": "Безіменна таблиця",
    "No data found.": "Даних не знайдено.",
    "Expand": "Відкрити"
});

const { Column, HeaderCell, Cell } = Table;

const PartLookup = ({ part, onExpand = () => {} }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [errorText, setErrorText] = useState(null);
    const [errorTitle, setErrorTitle] = useState("");
    const [expanded, setExpanded] = useState([]);
    const { str } = useLocale();

    useEffect(() => {
        if (expanded.length > 0)
            onExpand();
    }, [expanded, onExpand])

    const handleError = useCallback((reason) => {
        console.error(reason);
        const title = str("Error"); // Use str for translation
        setErrorText(reason.message || String(reason)); // Ensure reason is a string
        setErrorTitle(title);
    }, [str]); // str is not a dependency if it's a static function or imported

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                setErrorText(null); // Clear previous errors
                const url = `/api/v1/user/lookup_all_tables_all?part=${encodeURIComponent(part)}`;
                const result = await authFetch(url);
                setData(await result.json());
            } catch (reason) {
                handleError(reason);
            } finally {
                setLoading(false);
            }
        };

        if (part) { // Only fetch if 'part' is provided
            fetchData();
        }
    }, [part, handleError]);

    return (
        <div>
            {loading && <Loader center />}
            {errorText && (
                <ErrorMessage
                    errorText={errorText}
                    onClose={() => setErrorText(null)}
                    title={errorTitle}
                />
            )}
            {data != null && (
                data.map(([tableName, tableData], index) => {
                    if (!Array.isArray(tableData) || tableData.length === 0) {
                        return (
                            <StyledTableContainer key={tableName || `table-${index}`}>
                                <h4><Trans>Table</Trans> {tableName || `Unnamed Table ${index + 1}`}</h4>
                                <p><Trans>No data available for this table.</Trans></p>
                            </StyledTableContainer>
                        );
                    }

                    // Extract all unique column headers from all rows in the tableData
                    const columns = Array.from(new Set(tableData.flatMap(Object.keys)));
                    if (expanded.includes(tableName))
                        return (
                            <StyledTableContainer key={tableName || `table-${index}`}>
                                <h4><Trans>Table</Trans> {tableName || `Unnamed Table ${index + 1}`}</h4>
                                <Table
                                    data={tableData}
                                    autoHeight
                                    wordWrap
                                    minHeight={200} // Minimum height to prevent flickering during data load
                                    bordered
                                    resizable
                                    virtualized
                                    cellBordered
                                    className="fade-in-simple"
                                >
                                    {columns.map(columnKey => (
                                        <Column key={columnKey} flexGrow={1} minWidth={100}>
                                            <HeaderCell>{columnKey}</HeaderCell>
                                            <Cell dataKey={columnKey} />
                                        </Column>
                                    ))}
                                </Table>
                            </StyledTableContainer>
                        );
                    else {
                        return (<Panel key={tableName} header={tableName}>
                            <p>{columns.join(", ")}</p>
                            <IconButton icon={<ArrowDownLine />} onClick={() => setExpanded([...expanded, tableName])}><Trans>Expand</Trans></IconButton>
                        </Panel>)
                    }
                })
            )}
            {!loading && !errorText && !data && <p><Trans>No data found.</Trans></p>}
        </div>
    );
};

export default PartLookup;