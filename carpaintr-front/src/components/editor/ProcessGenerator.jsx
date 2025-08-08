// components/ProcessorGenerator.jsx

import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import {
    Form,
    Button,
    ButtonToolbar,
    Input,
    InputNumber,
    TagPicker,
    Stack,
    IconButton,
    Tooltip,
    Whisper,
    Panel,
    Notification,
    toaster,
    Loader,
    Container,
    Header,
    Content,
    Schema,
    Divider,
} from 'rsuite';
import { Copy, Trash2, PlusCircle, ArrowLeft, UploadCloud } from 'lucide-react';
import { authFetch } from '../../utils/authFetch';
import Trans from '../../localization/Trans';
import { registerTranslations, useLocale } from '../../localization/LocaleContext';

const uploadEndpoint = 'editor/upload_user_file';

registerTranslations("ua", {
    "Generated Code for": "Згенерований код для",
    "You can make final manual edits below before uploading.": "Ви можете внести остаточні ручні зміни перед завантаженням.",
    "Back to Form": "Повернутись до форми",
    "Upload to Server": "Завантажити на сервер",
    "Ordering Number": "Номер таблиці (порядок)",
    "Required Repair Types": "Необхідні типи ремонту",
    "Add Item": "Додати елемент",
    "JS expression for the value. E.g., `tableData[\"t1\"][\"field1\"]`": "JS-вираз для значення. Наприклад, `tableData[\"t1\"][\"field1\"]`",
    "Tooltip": "Підказка",
    "Condition": "Умова відображення",
    "Optional JS expression. If filled, wraps the row in an `if` block.": "Необов'язковий JS-вираз. Якщо заповнено, обгортає рядок у блок `if`.",
    "Remove Clause": "Видалити рядок виводу",
    "Add Row Clause": "Додати рядок виводу",
    "Generate Code": "Згенерувати код",
    "Required Tables": "Необхідні таблиці",
    "Required Files": "Необхідні файли",
    "Processor Generator": "Генератор процесора",
    "Processor Name": "Назва процесора",
    "Used for the object `name` and the filename (spaces become underscores).": "Використовується для імені об'єкта та назви файлу (пробіли замінюються на підкреслення).",
    "Category": "Категорія",
    "Row Clause Section": "Секція рядків виводу",
    "Variables": "Параметри",
    "Evaluate": "Вираз для обчислення або значення",
});


// Helper for unique IDs in lists
let clauseIdCounter = 0;
const nextId = () => `clause_${Date.now()}_${clauseIdCounter++}`;

const Variables = () => {
    return <p style={{ fontFamily: 'monospace', fontSize: 'x-small', color: '#777', marginBottom: '1rem' }}>
        <Trans>Variables</Trans>: (carPart, tableData, repairAction, files, carClass, carBodyType, carYear, carModel, paint)
    </p>
}

// ==================================
//      String List Editor
// ==================================
const StringListEditor = ({ value = [], onChange, label }) => {
    const handleAdd = () => onChange([...value, '']);
    const handleRemove = (index) => onChange(value.filter((_, i) => i !== index));
    const handleDuplicate = (index) => {
        const newValue = [...value];
        newValue.splice(index + 1, 0, value[index]);
        onChange(newValue);
    };
    const handleChange = (itemValue, index) => {
        const newValue = [...value];
        newValue[index] = itemValue;
        onChange(newValue);
    };

    return (
        <Form.Group>
            <Form.ControlLabel>{label}</Form.ControlLabel>
            {value.map((item, index) => (
                <Stack key={index} spacing={6} style={{ marginBottom: '5px' }}>
                    <Input value={item} onChange={(val) => handleChange(val, index)} />
                    <Whisper placement="top" speaker={<Tooltip><Trans>Duplicate</Trans></Tooltip>}>
                        <IconButton icon={<Copy size={16} />} onClick={() => handleDuplicate(index)} />
                    </Whisper>
                    <Whisper placement="top" speaker={<Tooltip><Trans>Remove</Trans></Tooltip>}>
                        <IconButton icon={<Trash2 size={16} />} color="red" appearance="subtle" onClick={() => handleRemove(index)} />
                    </Whisper>
                </Stack>
            ))}
            <Button appearance="ghost" onClick={handleAdd} startIcon={<PlusCircle size={16} />}>
                <Trans>Add Item</Trans>
            </Button>
            <Divider />
        </Form.Group>
    );
};

StringListEditor.propTypes = {
    value: PropTypes.arrayOf(PropTypes.string).isRequired,
    onChange: PropTypes.func.isRequired,
    label: PropTypes.string.isRequired,
};

// ==================================
//      Row Clause Editor
// ==================================
const ClauseListEditor = ({ value = [], onChange }) => {
    const { str } = useLocale();
    const handleAddClause = () => {
        const newClause = {
            id: nextId(),
            name: '',
            evaluate: '',
            tooltip: '',
            condition: '',
        };
        onChange([...value, newClause]);
    };

    const handleRemoveClause = (id) => {
        onChange(value.filter((clause) => clause.id !== id));
    };

    const handleClauseChange = (id, field, fieldValue) => {
        onChange(
            value.map((clause) =>
                clause.id === id ? { ...clause, [field]: fieldValue } : clause
            )
        );
    };

    return (
        <Panel header={str("Row Clause Section")} bordered>
            <Variables />
            {value.map((clause) => (
                <Panel shaded key={clause.id} bordered style={{ marginBottom: '10px', backgroundColor: 'ghostwhite' }}>
                    <Form layout="horizontal">
                        <Form.Group>
                            <Form.ControlLabel><Trans>Name</Trans></Form.ControlLabel>
                            <Form.Control name="name" value={clause.name} onChange={(val) => handleClauseChange(clause.id, 'name', val)} />
                        </Form.Group>
                        <Form.Group>
                            <Form.ControlLabel><Trans>Evaluate</Trans></Form.ControlLabel>
                            <Form.Control name="evaluate" value={clause.evaluate} onChange={(val) => handleClauseChange(clause.id, 'evaluate', val)} />
                            <Form.HelpText><Trans>JS expression for the value. E.g., `tableData["t1"]["field1"]`</Trans></Form.HelpText>
                        </Form.Group>
                        <Form.Group>
                            <Form.ControlLabel><Trans>Tooltip</Trans></Form.ControlLabel>
                            <Form.Control name="tooltip" value={clause.tooltip} onChange={(val) => handleClauseChange(clause.id, 'tooltip', val)} />
                        </Form.Group>
                        <Form.Group>
                            <Form.ControlLabel><Trans>Condition</Trans></Form.ControlLabel>
                            <Form.Control name="condition" value={clause.condition} onChange={(val) => handleClauseChange(clause.id, 'condition', val)} />
                            <Form.HelpText><Trans>Optional JS expression. If filled, wraps the row in an `if` block.</Trans></Form.HelpText>
                        </Form.Group>
                        <Button color="red" appearance="subtle" onClick={() => handleRemoveClause(clause.id)}>
                            <Trans>Remove Clause</Trans>
                        </Button>
                    </Form>
                </Panel>
            ))}
            <Button appearance="primary" onClick={handleAddClause} startIcon={<PlusCircle size={16} />}>
                <Trans>Add Row Clause</Trans>
            </Button>
        </Panel>
    );
};

ClauseListEditor.propTypes = {
    value: PropTypes.arrayOf(PropTypes.object).isRequired,
    onChange: PropTypes.func.isRequired,
};

// ==================================
//      Main Generator Component
// ==================================
const ProcessorGenerator = () => {
    const { str } = useLocale();
    const [stage, setStage] = useState('form'); // 'form' or 'code'
    const [uploading, setUploading] = useState(false);
    const [formData, setFormData] = useState({
        name: 'demo_processor',
        category: 'General',
        orderingNum: 100,
        requiredTables: ['t1'],
        requiredRepairTypes: [],
        requiredFiles: [],
        shouldRunCondition: "",
        clauses: [
            { id: nextId(), name: 'mount part', evaluate: 'tableData["t1"]["field1"]', tooltip: 'Just mount part', condition: '' },
            { id: nextId(), name: 'paint part (one side)', evaluate: 'tableData["t1"]["field2"]', tooltip: 'Just paint part', condition: 'repairAction == "paint_one_side"' },
        ],
    });
    const [generatedCode, setGeneratedCode] = useState('');

    const repairTypeOptions = [
        'paint_two_sides', 'paint_one_side', 'polish',
        'replace_and_paint_original', 'replace_and_paint_3rdparty',
        'replace_and_paint_used', 'replace_no_paint', 'toning'
    ].map(item => ({ label: item, value: str(item) }));

    const generateProcessorCode = useCallback(() => {
        const { name, category, orderingNum, requiredTables, requiredRepairTypes, requiredFiles, clauses, shouldRunCondition } = formData;

        const renderClauses = () => {
            return clauses.map(clause => {
                const rowObject = `{name: "${clause.name}", evaluate: ${clause.evaluate || 'null'}, tooltip: "${clause.tooltip}"}`;
                const pushStatement = `output.push(mkRow(${rowObject}));`;

                if (clause.condition && clause.condition.trim() !== '') {
                    return `        if (${clause.condition}) {\n            ${pushStatement}\n        }`;
                }
                return `        ${pushStatement}`;
            }).join('\n');
        };

        const code = `({
    name: "${name}",
    shouldRun: (x, carPart, tableData, repairAction, files, carClass, carBodyType, carYear, carModel, paint) => {
        ${shouldRunCondition || "return true;"}
    },
    run: (x, carPart, tableData, repairAction, files, carClass, carBodyType, carYear, carModel, paint) => {
        // - init section -
        var output = [];
        const { mkRow } = x;

        // - check data section -
        // leave blank now, there are no data validation stages yet

        // - row clause section -
${renderClauses()}

        // - final section -
        return output;
    },
    requiredTables: ${JSON.stringify(requiredTables)},
    requiredRepairTypes: ${JSON.stringify(requiredRepairTypes)},
    requiredFiles: ${JSON.stringify(requiredFiles)},
    category: "${category}",
    orderingNum: ${orderingNum}
})`;

        setGeneratedCode(code);
        setStage('code');
    }, [formData]);

    const handleUpload = async () => {
        setUploading(true);

        const sanitizedName = formData.name.replace(/\s+/g, '_');
        const filePath = `procs/${sanitizedName}.js`;
        const fileContent = new Blob([generatedCode], { type: 'application/javascript' });

        const uploadFormData = new FormData();
        uploadFormData.append('file', fileContent, `${sanitizedName}.js`);

        try {
            const response = await authFetch(`/api/v1/${uploadEndpoint}/${encodeURIComponent(filePath)}`, {
                method: 'POST',
                body: uploadFormData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            toaster.push(
                <Notification type="success" header="Upload Successful" closable>
                    Processor '{formData.name}' uploaded to {result.path}.
                </Notification>
            );

        } catch (error) {
            toaster.push(
                <Notification type="error" header="Upload Failed" closable>
                    {error.message}
                </Notification>
            );
        } finally {
            setUploading(false);
        }
    };

    const renderStage1 = () => (
        <>
            <Header><h2><Trans>Processor Generator</Trans></h2></Header>
            <Content>
                <Form fluid model={formModel} formValue={formData} onChange={setFormData}>
                    <Form.Group>
                        <Form.ControlLabel><Trans>Processor Name</Trans></Form.ControlLabel>
                        <Form.Control name="name" />
                        <Form.HelpText><Trans>Used for the object `name` and the filename (spaces become underscores).</Trans></Form.HelpText>
                    </Form.Group>

                    <Form.Group>
                        <Form.ControlLabel><Trans>Category</Trans></Form.ControlLabel>
                        <Form.Control name="category" />
                    </Form.Group>

                    <Form.Group>
                        <Form.ControlLabel><Trans>Ordering Number</Trans></Form.ControlLabel>
                        <Form.Control name="orderingNum" accepter={InputNumber} />
                    </Form.Group>

                    <Form.Group>
                        <Form.ControlLabel><Trans>Required Repair Types</Trans></Form.ControlLabel>
                        <Form.Control name="requiredRepairTypes" data={repairTypeOptions} accepter={TagPicker} style={{ width: '100%' }} />
                    </Form.Group>

                    <Panel collapsible bordered header={str("Condition")}>
                        <Form.Group>
                            <Variables />
                            <Form.ControlLabel><Trans>Condition</Trans></Form.ControlLabel>
                            <Input
                                as="textarea"
                                rows={5}
                                name="shouldRunCondition"
                                value={formData.shouldRunCondition}
                                onChange={value =>
                                    setFormData({ ...formData, shouldRunCondition: value })
                                }
                                style={{ fontFamily: 'monospace', fontSize: '12px', marginBottom: '1rem' }}
                            />
                        </Form.Group>
                    </Panel>

                    <StringListEditor
                        label={str("Required Tables")}
                        value={formData.requiredTables}
                        onChange={(value) => setFormData({ ...formData, requiredTables: value })}
                    />

                    <StringListEditor
                        label={str("Required Files")}
                        value={formData.requiredFiles}
                        onChange={(value) => setFormData({ ...formData, requiredFiles: value })}
                    />

                    <ClauseListEditor
                        value={formData.clauses}
                        onChange={(value) => setFormData({ ...formData, clauses: value })}
                    />

                    <Form.Group>
                        <ButtonToolbar>
                            <Button appearance="primary" onClick={generateProcessorCode}>
                                <Trans>Generate Code</Trans>
                            </Button>
                        </ButtonToolbar>
                    </Form.Group>
                </Form>
            </Content>
        </>
    );

    const renderStage2 = () => (
        <>
            <Header>
                <h2><Trans>Generated Code for</Trans> '{formData.name}'</h2>
                <p><Trans>You can make final manual edits below before uploading.</Trans></p>
            </Header>
            <Content>
                <Input
                    as="textarea"
                    rows={25}
                    value={generatedCode}
                    onChange={setGeneratedCode}
                    style={{ fontFamily: 'monospace', fontSize: '12px', marginBottom: '1rem' }}
                />
                <ButtonToolbar>
                    <Button onClick={() => setStage('form')} color='red' startIcon={<ArrowLeft />}>
                        <Trans>Back to Form</Trans>
                    </Button>
                    <Button appearance="primary" color='green' onClick={handleUpload} loading={uploading} startIcon={!uploading && <UploadCloud />}>
                        <Trans>Upload to Server</Trans>
                    </Button>
                </ButtonToolbar>
            </Content>
        </>
    );

    const { StringType, NumberType, ArrayType } = Schema.Types;
    const formModel = Schema.Model({
        name: StringType().isRequired('Processor name is required.'),
        category: StringType(),
        orderingNum: NumberType(),
        requiredTables: ArrayType(),
        shouldRunCondition: StringType(),
        requiredRepairTypes: ArrayType(),
        requiredFiles: ArrayType(),
    });

    return (
        <Container style={{ padding: '20px' }}>
            {uploading && <Loader backdrop content="uploading..." vertical />}
            {stage === 'form' ? renderStage1() : renderStage2()}
        </Container>
    );
};

export default ProcessorGenerator;
