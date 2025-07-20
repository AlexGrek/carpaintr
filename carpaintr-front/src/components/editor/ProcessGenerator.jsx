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
} from 'rsuite';
import { Copy, Trash2, PlusCircle, ArrowLeft, UploadCloud } from 'lucide-react';
import { authFetch } from '../../utils/authFetch';

const uploadEndpoint = 'editor/upload_user_file';

// Helper for unique IDs in lists
let clauseIdCounter = 0;
const nextId = () => `clause_${Date.now()}_${clauseIdCounter++}`;

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
                    <Whisper placement="top" speaker={<Tooltip>Duplicate</Tooltip>}>
                        <IconButton icon={<Copy size={16} />} onClick={() => handleDuplicate(index)} />
                    </Whisper>
                    <Whisper placement="top" speaker={<Tooltip>Remove</Tooltip>}>
                        <IconButton icon={<Trash2 size={16} />} color="red" appearance="subtle" onClick={() => handleRemove(index)} />
                    </Whisper>
                </Stack>
            ))}
            <Button appearance="ghost" onClick={handleAdd} startIcon={<PlusCircle size={16} />}>
                Add Item
            </Button>
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
        <Panel header="Row Clause Section" bordered>
            <p style={{ fontFamily: 'monospace', color: '#777', marginBottom: '1rem' }}>
                Variables: (carPart, tableData, repairAction, files, carClass, carBodyType, carYear, carModel, paint)
            </p>
            {value.map((clause) => (
                <Panel key={clause.id} bordered style={{ marginBottom: '10px' }}>
                    <Form layout="horizontal">
                        <Form.Group>
                            <Form.ControlLabel>Name</Form.ControlLabel>
                            <Form.Control name="name" value={clause.name} onChange={(val) => handleClauseChange(clause.id, 'name', val)} />
                        </Form.Group>
                        <Form.Group>
                            <Form.ControlLabel>Evaluate</Form.ControlLabel>
                            <Form.Control name="evaluate" value={clause.evaluate} onChange={(val) => handleClauseChange(clause.id, 'evaluate', val)} />
                            <Form.HelpText>JS expression for the value. E.g., `tableData["t1"]["field1"]`</Form.HelpText>
                        </Form.Group>
                        <Form.Group>
                            <Form.ControlLabel>Tooltip</Form.ControlLabel>
                            <Form.Control name="tooltip" value={clause.tooltip} onChange={(val) => handleClauseChange(clause.id, 'tooltip', val)} />
                        </Form.Group>
                        <Form.Group>
                            <Form.ControlLabel>Condition</Form.ControlLabel>
                            <Form.Control name="condition" value={clause.condition} onChange={(val) => handleClauseChange(clause.id, 'condition', val)} />
                            <Form.HelpText>Optional JS expression. If filled, wraps the row in an `if` block.</Form.HelpText>
                        </Form.Group>
                        <Button color="red" appearance="subtle" onClick={() => handleRemoveClause(clause.id)}>
                            Remove Clause
                        </Button>
                    </Form>
                </Panel>
            ))}
            <Button appearance="primary" onClick={handleAddClause} startIcon={<PlusCircle size={16} />}>
                Add Row Clause
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
    const [stage, setStage] = useState('form'); // 'form' or 'code'
    const [uploading, setUploading] = useState(false);
    const [formData, setFormData] = useState({
        name: 'demo_processor',
        category: 'General',
        orderingNum: 100,
        requiredTables: ['t1'],
        requiredRepairTypes: [],
        requiredFiles: [],
        clauses: [
            { id: nextId(), name: 'mount part', evaluate: 'tableData["t1"]["field1"]', tooltip: 'Just mount part', condition: '' },
            { id: nextId(), name: 'paint part (one side)', evaluate: 'tableData["t1"]["field2"]', tooltip: 'Just paint part', condition: 'repairAction == "paint_one_side"' },
        ],
    });
    const [generatedCode, setGeneratedCode] = useState('');

    const repairTypeOptions = [
        'paint_two_sides', 'paint_one_side', 'polish',
        'replace_and_paint_original', 'replace_and_paint_3rdparty',
        'replace_and_paint_used', 'replace_no_paint'
    ].map(item => ({ label: item, value: item }));

    const generateProcessorCode = useCallback(() => {
        const { name, category, orderingNum, requiredTables, requiredRepairTypes, requiredFiles, clauses } = formData;

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
    run: (carPart, tableData, repairAction, files, carClass, carBodyType, carYear, carModel, paint) => {
        // - init section -
        var output = [];

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
            <Header><h2>Processor Generator</h2></Header>
            <Content>
                <Form fluid model={formModel} formValue={formData} onChange={setFormData}>
                    <Form.Group>
                        <Form.ControlLabel>Processor Name</Form.ControlLabel>
                        <Form.Control name="name" />
                        <Form.HelpText>Used for the object `name` and the filename (spaces become underscores).</Form.HelpText>
                    </Form.Group>

                    <Form.Group>
                        <Form.ControlLabel>Category</Form.ControlLabel>
                        <Form.Control name="category" />
                    </Form.Group>

                    <Form.Group>
                        <Form.ControlLabel>Ordering Number</Form.ControlLabel>
                        <Form.Control name="orderingNum" accepter={InputNumber} />
                    </Form.Group>

                    <Form.Group>
                        <Form.ControlLabel>Required Repair Types</Form.ControlLabel>
                        <Form.Control name="requiredRepairTypes" data={repairTypeOptions} accepter={TagPicker} style={{ width: '100%' }} />
                    </Form.Group>

                    <StringListEditor
                        label="Required Tables"
                        value={formData.requiredTables}
                        onChange={(value) => setFormData({ ...formData, requiredTables: value })}
                    />

                    <StringListEditor
                        label="Required Files"
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
                                Generate Code
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
                <h2>Generated Code for '{formData.name}'</h2>
                <p>You can make final manual edits below before uploading.</p>
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
                    <Button onClick={() => setStage('form')} startIcon={<ArrowLeft />}>
                        Back to Form
                    </Button>
                    <Button appearance="primary" onClick={handleUpload} loading={uploading} startIcon={!uploading && <UploadCloud />}>
                        Upload to Server
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
