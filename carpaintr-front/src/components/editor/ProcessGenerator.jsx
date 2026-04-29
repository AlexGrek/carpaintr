// components/ProcessorGenerator.jsx

import { useState, useCallback, Suspense, lazy, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Form,
  Button,
  ButtonToolbar,
  Input,
  NumberInput,
  TagPicker,
  Stack,
  IconButton,
  Tooltip,
  Whisper,
  Panel,
  Notification,
  Loader,
  Container,
  Header,
  Content,
  Schema,
  Divider,
  HStack,
  InputPicker,
  TreePicker,
  useToaster,
  Drawer,
} from "rsuite";
import { useMediaQuery } from "react-responsive";
import {
  Copy,
  Trash2,
  PlusCircle,
  ArrowLeft,
  UploadCloud,
  Trash,
  CopyPlus,
} from "lucide-react";
import { authFetch, authFetchJson } from "../../utils/authFetch";
import Trans from "../../localization/Trans";
import {
  registerTranslations,
  useLocale,
} from "../../localization/LocaleContext";
import SearchIcon from "@rsuite/icons/Search";
import { isArrayLike } from "lodash";

const uploadEndpoint = "editor/upload_user_file";

const PartsCatalog = lazy(() => import("../catalog/PartsCatalog"));

registerTranslations("ua", {
  "Generated Code for": "Згенерований код для",
  "You can make final manual edits below before uploading.":
    "Ви можете внести остаточні ручні зміни перед завантаженням.",
  "Back to Form": "Повернутись до форми",
  "Upload to Server": "Завантажити на сервер",
  "Ordering Number": "Номер таблиці (порядок)",
  "Required Repair Types": "Необхідні типи ремонту",
  "Add Item": "Додати елемент",
  'JS expression for the value. E.g., `tableData["t1"]["field1"]`':
    'JS-вираз для значення. Наприклад, `tableData["t1"]["field1"]`',
  Tooltip: "Підказка",
  Condition: "Умова відображення",
  "Optional JS expression. If filled, wraps the row in an `if` block.":
    "Необов'язковий JS-вираз. Якщо заповнено, обгортає рядок у блок `if`.",
  "Trace Table": "Таблиця (трасування)",
  "Trace Field": "Поле (трасування)",
  "Optional. Marks which table/field this row&apos;s value came from.":
    "Необов'язково. Вказує, з якої таблиці/поля отримано значення цього рядка.",
  "Remove Clause": "Видалити рядок виводу",
  "Duplicate Clause": "Дублювати рядок виводу",
  "Add Row Clause": "Додати рядок виводу",
  "Generate Code": "Згенерувати код",
  "Required Tables": "Необхідні таблиці",
  "Required Files": "Необхідні файли",
  "Processor Generator": "Генератор процесора",
  "Processor Name": "Назва процесора",
  "Used for the object `name` and the filename (spaces become underscores).":
    "Використовується для імені об'єкта та назви файлу (пробіли замінюються на підкреслення).",
  Category: "Категорія",
  "Row Clause Section": "Секція рядків виводу",
  Variables: "Параметри",
  Evaluate: "Вираз для обчислення або значення",
  Catalog: "Каталог",
});

// Helper for unique IDs in lists
let clauseIdCounter = 0;
const nextId = () => `clause_${Date.now()}_${clauseIdCounter++}`;

const Variables = () => {
  return (
    <p
      style={{
        fontFamily: "monospace",
        fontSize: "x-small",
        color: "#777",
        marginBottom: "1rem",
      }}
    >
      <Trans>Variables</Trans>: (carPart, tableData, repairAction, files,
      carClass, carBodyType, carYear, carModel, paint)
    </p>
  );
};

// ==================================
//      String List Editor
// ==================================
const StringListEditor = ({
  value = [],
  onChange,
  label,
  autocomplete = [],
}) => {
  const handleAdd = () => onChange([...value, ""]);
  const { str } = useLocale();
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

  // Convert autocomplete array to InputPicker data format
  const pickerData = autocomplete.map((item) => ({
    label: item,
    value: item,
  }));

  return (
    <Form.Group>
      <Form.ControlLabel>{label}</Form.ControlLabel>
      {value.map((item, index) => (
        <Stack
          className="fade-in-expand-simple"
          key={index}
          spacing={6}
          style={{ marginBottom: "5px" }}
        >
          <InputPicker
            data={pickerData}
            value={item}
            onChange={(val) => handleChange(val, index)}
            creatable
            searchable
            placeholder={str("Select or type...")}
            style={{ width: "100%" }}
          />
          <Whisper
            placement="top"
            speaker={
              <Tooltip>
                <Trans>Duplicate</Trans>
              </Tooltip>
            }
          >
            <IconButton
              icon={<Copy size={16} />}
              onClick={() => handleDuplicate(index)}
            />
          </Whisper>
          <Whisper
            placement="top"
            speaker={
              <Tooltip>
                <Trans>Remove</Trans>
              </Tooltip>
            }
          >
            <IconButton
              icon={<Trash2 size={16} />}
              color="red"
              appearance="subtle"
              onClick={() => handleRemove(index)}
            />
          </Whisper>
        </Stack>
      ))}
      <Button
        appearance="ghost"
        onClick={handleAdd}
        startIcon={<PlusCircle size={16} />}
      >
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
  autocomplete: PropTypes.arrayOf(PropTypes.string),
};

// ==================================
//      Row Clause Editor
// ==================================
const ClauseListEditor = ({
  value = [],
  onChange,
  tables = [],
  allTablesData,
}) => {
  const { str } = useLocale();
  const isMobile = useMediaQuery({ maxWidth: 767 });
  const handleAddClause = () => {
    const newClause = {
      id: nextId(),
      name: "",
      evaluate: "",
      tooltip: "",
      condition: "",
      traceTable: "",
      traceField: "",
    };
    onChange([...value, newClause]);
  };

  const handleDuplicateClause = (clause) => {
    const newClause = {
      ...clause,
      id: nextId(),
    };
    onChange([...value, newClause]);
  };

  const handleRemoveClause = (id) => {
    onChange(value.filter((clause) => clause.id !== id));
  };

  const handleClauseChange = (id, field, fieldValue) => {
    onChange(
      value.map((clause) =>
        clause.id === id ? { ...clause, [field]: fieldValue } : clause,
      ),
    );
  };

  const handleEvaluatePick = (id, val) => {
    const match = val && val.match(/^tableData\["([^"]+)"\]\["([^"]+)"\]$/);
    onChange(
      value.map((clause) =>
        clause.id === id
          ? {
              ...clause,
              evaluate: val,
              ...(match
                ? { traceTable: match[1], traceField: match[2] }
                : {}),
            }
          : clause,
      ),
    );
  };

  return (
    <Panel header={str("Row Clause Section")} bordered>
      <Variables />
      {value.map((clause) => (
        <Panel
          shaded
          className="fade-in-simple"
          key={clause.id}
          bordered
          style={{
            marginBottom: "12px",
            backgroundColor: "#fff",
            borderRadius: "8px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            border: "1px solid #e8e8e8",
          }}
        >
          <Form layout={isMobile ? "vertical" : "horizontal"}>
            <Form.Group>
              <Form.ControlLabel>
                <Trans>Name</Trans>
              </Form.ControlLabel>
              <Form.Control
                name="name"
                value={clause.name}
                onChange={(val) => handleClauseChange(clause.id, "name", val)}
              />
            </Form.Group>
            <Form.Group>
              <Form.ControlLabel>
                <Trans>Evaluate</Trans>
              </Form.ControlLabel>
              <Form.Control
                name="evaluate"
                value={clause.evaluate}
                onChange={(val) =>
                  handleClauseChange(clause.id, "evaluate", val)
                }
              />
              <TreePicker
                searchable={false}
                data={allTablesData.filter((item) =>
                  tables.includes(item.label),
                )}
                value={clause.evaluate}
                onChange={(val) => handleEvaluatePick(clause.id, val)}
                defaultExpandAll
              />
              <Form.HelpText>
                {str('JS expression for the value. E.g., `tableData["t1"]["field1"]`')}
              </Form.HelpText>
            </Form.Group>
            <Form.Group>
              <Form.ControlLabel>
                <Trans>Tooltip</Trans>
              </Form.ControlLabel>
              <Form.Control
                name="tooltip"
                value={clause.tooltip}
                onChange={(val) =>
                  handleClauseChange(clause.id, "tooltip", val)
                }
              />
            </Form.Group>
            <Form.Group>
              <Form.ControlLabel>
                <Trans>Condition</Trans>
              </Form.ControlLabel>
              <Form.Control
                name="condition"
                value={clause.condition}
                onChange={(val) =>
                  handleClauseChange(clause.id, "condition", val)
                }
              />
              <Form.HelpText>
                <Trans>
                  Optional JS expression. If filled, wraps the row in an `if`
                  block.
                </Trans>
              </Form.HelpText>
            </Form.Group>
            <Form.Group>
              <Form.ControlLabel>
                <Trans>Trace Table</Trans>
              </Form.ControlLabel>
              <Form.Control
                name="traceTable"
                value={clause.traceTable || ""}
                onChange={(val) =>
                  handleClauseChange(clause.id, "traceTable", val)
                }
              />
            </Form.Group>
            <Form.Group>
              <Form.ControlLabel>
                <Trans>Trace Field</Trans>
              </Form.ControlLabel>
              <Form.Control
                name="traceField"
                value={clause.traceField || ""}
                onChange={(val) =>
                  handleClauseChange(clause.id, "traceField", val)
                }
              />
              <Form.HelpText>
                <Trans>
                  Optional. Marks which table/field this row&apos;s value came from.
                </Trans>
              </Form.HelpText>
            </Form.Group>
            <HStack spacing={8} style={{ marginTop: "4px" }}>
              <IconButton
                icon={<CopyPlus size={16} />}
                circle
                onClick={() => handleDuplicateClause(clause)}
              />
              <IconButton
                icon={<Trash size={16} />}
                color="red"
                circle
                appearance="subtle"
                onClick={() => handleRemoveClause(clause.id)}
              />
            </HStack>
          </Form>
        </Panel>
      ))}
      <Button
        appearance="primary"
        onClick={handleAddClause}
        startIcon={<PlusCircle size={16} />}
      >
        <Trans>Add Row Clause</Trans>
      </Button>
    </Panel>
  );
};

ClauseListEditor.propTypes = {
  value: PropTypes.arrayOf(PropTypes.object).isRequired,
  tables: PropTypes.arrayOf(PropTypes.string).isRequired,
  onChange: PropTypes.func.isRequired,
};

// ==================================
//      Main Generator Component
// ==================================
const ProcessorGenerator = () => {
  const { str } = useLocale();
  const isMobile = useMediaQuery({ maxWidth: 767 });
  const [stage, setStage] = useState("form"); // 'form' or 'code'
  const [uploading, setUploading] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "demo_processor",
    category: "General",
    orderingNum: 100,
    requiredTables: ["t1"],
    requiredRepairTypes: [],
    requiredFiles: [],
    shouldRunCondition: "",
    clauses: [
      {
        id: nextId(),
        name: "mount part",
        evaluate: 'tableData["t1"]["field1"]',
        tooltip: "Just mount part",
        condition: "",
        traceTable: "t1",
        traceField: "field1",
      },
      {
        id: nextId(),
        name: "paint part (one side)",
        evaluate: 'tableData["t1"]["field2"]',
        tooltip: "Just paint part",
        condition: 'repairAction == "Ремонт з зовнішнім фарбуванням"',
        traceTable: "t1",
        traceField: "field2",
      },
    ],
  });
  const [generatedCode, setGeneratedCode] = useState("");
  const [allTablesData, setAllTablesData] = useState({});
  const toaster = useToaster();

  useEffect(() => {
    const fetchAllTablesData = async () => {
      const data = await authFetchJson("/api/v1/editor/all_tables_headers");
      setAllTablesData(data);
      await fetchRepairTypeOptionsRaw();
    };
    const fetchRepairTypeOptionsRaw = async () => {
      const data = await authFetchJson("/api/v1/user/list_all_repair_types");
      if (isArrayLike(data)) {
        setRepairTypeOptions(
          data.map((item) => ({ label: item, value: str(item) })),
        );
      } else {
        toaster.push(<Notification>{JSON.stringify(data)}</Notification>);
      }
    };
    fetchAllTablesData();
  }, [str, toaster]);

  const [repairTypeOptions, setRepairTypeOptions] = useState([]);

  const generateProcessorCode = useCallback(() => {
    const {
      name,
      category,
      orderingNum,
      requiredTables,
      requiredRepairTypes,
      requiredFiles,
      clauses,
      shouldRunCondition,
    } = formData;

    const renderClauses = () => {
      return clauses
        .map((clause) => {
          const traceStr =
            clause.traceTable && clause.traceField
              ? `, trace: traceRowToTable("${clause.traceTable}", "${clause.traceField}")`
              : "";
          const rowObject = `{name: "${clause.name}", evaluate: ${clause.evaluate || "null"}, tooltip: "${clause.tooltip}"${traceStr}}`;
          const pushStatement = `output.push(mkRow(${rowObject}));`;

          if (clause.condition && clause.condition.trim() !== "") {
            return `        if (${clause.condition}) {\n            ${pushStatement}\n        }`;
          }
          return `        ${pushStatement}`;
        })
        .join("\n");
    };

    const code = `({
    name: "${name}",
    shouldRun: (x, carPart, tableData, repairAction, files, carClass, carBodyType, carYear, carModel, paint, pricing) => {
        ${shouldRunCondition || "return true;"}
    },
    run: (x, carPart, tableData, repairAction, files, carClass, carBodyType, carYear, carModel, paint, pricing) => {
        // - init section -
        var output = [];
        const { mkRow, traceRowToTable } = x;

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
    setStage("code");
  }, [formData]);

  const handleUpload = async () => {
    setUploading(true);

    const sanitizedName = formData.name.replace(/\s+/g, "_");
    const filePath = `procs/${sanitizedName}.js`;
    const fileContent = new Blob([generatedCode], {
      type: "application/javascript",
    });

    const uploadFormData = new FormData();
    uploadFormData.append("file", fileContent, `${sanitizedName}.js`);

    try {
      const response = await authFetch(
        `/api/v1/${uploadEndpoint}/${encodeURIComponent(filePath)}`,
        {
          method: "POST",
          body: uploadFormData,
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || `HTTP error! status: ${response.status}`,
        );
      }

      const result = await response.json();
      toaster.push(
        <Notification type="success" header="Upload Successful" closable>
          Processor &apos;{formData.name}&apos; uploaded to {result.path}.
        </Notification>,
      );
    } catch (error) {
      toaster.push(
        <Notification type="error" header="Upload Failed" closable>
          {error.message}
        </Notification>,
      );
    } finally {
      setUploading(false);
    }
  };

  const renderStage1 = () => {
    const catalogContent = (
      <Suspense fallback={<Loader />}>
        <PartsCatalog />
      </Suspense>
    );

    const formContent = (
      <Content
        style={{
          maxWidth: isMobile ? "100%" : "600px",
          width: "100%",
          padding: isMobile ? "0 4px" : undefined,
        }}
      >
        <HStack
          spacing={8}
          alignItems="center"
          style={{ marginBottom: "8px" }}
        >
          <IconButton
            icon={<SearchIcon />}
            appearance={catalogOpen ? "primary" : "ghost"}
            onClick={() => setCatalogOpen(!catalogOpen)}
          >
            <Trans>Catalog</Trans>
          </IconButton>
        </HStack>

        <Header style={{ marginBottom: "16px" }}>
          <h2 style={{ margin: 0, fontSize: isMobile ? "20px" : "24px" }}>
            <Trans>Processor Generator</Trans>
          </h2>
        </Header>

        <Form
          fluid
          model={formModel}
          formValue={formData}
          onChange={setFormData}
        >
          <Form.Group>
            <Form.ControlLabel>
              <Trans>Processor Name</Trans>
            </Form.ControlLabel>
            <Form.Control name="name" />
            <Form.HelpText>
              <Trans>
                Used for the object `name` and the filename (spaces become
                underscores).
              </Trans>
            </Form.HelpText>
          </Form.Group>

          <Form.Group>
            <Form.ControlLabel>
              <Trans>Category</Trans>
            </Form.ControlLabel>
            <Form.Control name="category" />
          </Form.Group>

          <Form.Group>
            <Form.ControlLabel>
              <Trans>Ordering Number</Trans>
            </Form.ControlLabel>
            <Form.Control name="orderingNum" accepter={NumberInput} />
          </Form.Group>

          <Form.Group>
            <Form.ControlLabel>
              <Trans>Required Repair Types</Trans>
            </Form.ControlLabel>
            <Form.Control
              name="requiredRepairTypes"
              data={repairTypeOptions}
              accepter={TagPicker}
              style={{ width: "100%" }}
            />
          </Form.Group>

          <Panel collapsible bordered header={str("Condition")}>
            <Form.Group>
              <Variables />
              <Form.ControlLabel>
                <Trans>Condition</Trans>
              </Form.ControlLabel>
              <Input
                as="textarea"
                rows={5}
                name="shouldRunCondition"
                value={formData.shouldRunCondition}
                onChange={(value) =>
                  setFormData({ ...formData, shouldRunCondition: value })
                }
                style={{
                  fontFamily: "monospace",
                  fontSize: "12px",
                  marginBottom: "1rem",
                }}
              />
            </Form.Group>
          </Panel>

          <StringListEditor
            label={str("Required Tables")}
            autocomplete={allTablesData ? Object.keys(allTablesData) : []}
            value={formData.requiredTables}
            onChange={(value) =>
              setFormData({ ...formData, requiredTables: value })
            }
          />

          <StringListEditor
            label={str("Required Files")}
            value={formData.requiredFiles}
            onChange={(value) =>
              setFormData({ ...formData, requiredFiles: value })
            }
          />

          <ClauseListEditor
            value={formData.clauses}
            onChange={(value) => setFormData({ ...formData, clauses: value })}
            tables={formData.requiredTables}
            allTablesData={Object.keys(allTablesData).map((item) => {
              const value = allTablesData[item];
              return {
                label: item,
                children: value.map((inner) => ({
                  value: `tableData["${item}"]["${inner}"]`,
                  label: inner,
                  children: [],
                })),
                value: `tableData["${item}"]`,
              };
            })}
          />

          <Form.Group style={{ marginTop: "8px" }}>
            <Button
              appearance="primary"
              size={isMobile ? "lg" : "md"}
              block={isMobile}
              onClick={generateProcessorCode}
            >
              <Trans>Generate Code</Trans>
            </Button>
          </Form.Group>
        </Form>
      </Content>
    );

    return (
      <>
        {/* Mobile: catalog as bottom drawer */}
        {isMobile && (
          <Drawer
            open={catalogOpen}
            onClose={() => setCatalogOpen(false)}
            placement="bottom"
            size="lg"
          >
            <Drawer.Header>
              <Drawer.Title>
                <Trans>Catalog</Trans>
              </Drawer.Title>
            </Drawer.Header>
            <Drawer.Body>{catalogContent}</Drawer.Body>
          </Drawer>
        )}

        <div
          style={{
            display: "flex",
            gap: "40px",
            alignItems: "flex-start",
            justifyContent: "center",
          }}
        >
          {/* Desktop: inline catalog sidebar */}
          {!isMobile && catalogOpen && (
            <Panel
              bordered
              style={{
                minWidth: "230px",
                flexShrink: 0,
                borderRadius: "8px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
              }}
            >
              {catalogContent}
            </Panel>
          )}

          {formContent}
        </div>
      </>
    );
  };

  const renderStage2 = () => (
    <>
      <Header style={{ marginBottom: "16px" }}>
        <h2 style={{ margin: 0, fontSize: isMobile ? "18px" : "22px" }}>
          <Trans>Generated Code for</Trans>{" "}
          <span style={{ fontStyle: "italic", color: "#555" }}>
            {formData.name}
          </span>
        </h2>
        <p style={{ margin: "4px 0 0", color: "#888", fontSize: "13px" }}>
          <Trans>You can make final manual edits below before uploading.</Trans>
        </p>
      </Header>
      <Content>
        <Input
          as="textarea"
          rows={isMobile ? 16 : 25}
          value={generatedCode}
          onChange={setGeneratedCode}
          style={{
            fontFamily: "monospace",
            fontSize: "12px",
            marginBottom: "12px",
            borderRadius: "6px",
          }}
        />
        <ButtonToolbar
          style={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            gap: "8px",
          }}
        >
          <Button
            onClick={() => setStage("form")}
            color="red"
            appearance="ghost"
            block={isMobile}
            startIcon={<ArrowLeft size={16} />}
          >
            <Trans>Back to Form</Trans>
          </Button>
          <Button
            appearance="primary"
            color="green"
            onClick={handleUpload}
            loading={uploading}
            block={isMobile}
            startIcon={!uploading && <UploadCloud size={16} />}
          >
            <Trans>Upload to Server</Trans>
          </Button>
        </ButtonToolbar>
      </Content>
    </>
  );

  const { StringType, NumberType, ArrayType } = Schema.Types;
  const formModel = Schema.Model({
    name: StringType().isRequired("Processor name is required."),
    category: StringType(),
    orderingNum: NumberType(),
    requiredTables: ArrayType(),
    shouldRunCondition: StringType(),
    requiredRepairTypes: ArrayType(),
    requiredFiles: ArrayType(),
  });

  return (
    <Container style={{ padding: isMobile ? "12px 8px" : "20px" }}>
      {uploading && <Loader backdrop content="uploading..." vertical />}
      {stage === "form" ? renderStage1() : renderStage2()}
    </Container>
  );
};

export default ProcessorGenerator;
