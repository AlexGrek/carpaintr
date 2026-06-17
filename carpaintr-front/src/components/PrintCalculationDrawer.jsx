/* eslint-disable react/display-name */
import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Drawer,
  Button,
  Message,
  Input,
  Form,
  Stack,
  Divider,
  useToaster,
  Panel,
  Loader,
  Checkbox,
} from "rsuite";
import { useMediaQuery } from "react-responsive";
import { useLocale } from "../localization/LocaleContext";
import { authFetch } from "../utils/authFetch";
import { handleLicenseForbidden } from "../utils/licenseRedirect";
// Added for Generate Preview button
import Trans from "../localization/Trans";
import { isArrayLike } from "lodash";
import { File, FileDown } from "lucide-react";
import {
  buildTotalTables,
  totalTablesForTemplate,
} from "../calc/collapseTables";

// Print Document Generator Component
const PrintDocumentGenerator = React.memo(
  ({
    name,
    calculationData,
    collapseTables = false,
    totalTables = {},
    partsData: _partsData,
    carData,
    orderData,
    paintData,
    templateName,
  }) => {
    const { str } = useLocale();
    const toaster = useToaster();
    const [customTemplateContent, setCustomTemplateContent] = useState("");
    const [orderNumber, setOrderNumber] = useState(orderData.orderNumber);
    const [orderNotes, setOrderNotes] = useState("");
    const [htmlPreview, setHtmlPreview] = useState("");
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [clickedPreview, setClickedPreview] = useState(false);
    const [loadingDownload, setLoadingDownload] = useState(false);

    const showMessage = useCallback(
      (type, message) => {
        toaster.push(
          <Message type={type} closable duration={5000}>
            {message}
          </Message>,
          { placement: "topEnd" },
        );
      },
      [toaster],
    );

    const buildRequestPayload = useCallback(() => {
      const calcForTemplate = collapseTables
        ? totalTablesForTemplate(
            Object.keys(totalTables || {}).length > 0
              ? totalTables
              : buildTotalTables(calculationData),
          )
        : calculationData;

      return {
        calculation: {
          car: carData,
          paint: paintData,
          order: orderData,
          calc: calcForTemplate,
        },
        metadata: {
          order_number: orderNumber || null,
          order_notes: orderNotes || null,
        },
        custom_template_content: customTemplateContent || null,
        template_name: templateName || null,
      };
    }, [
      carData,
      paintData,
      orderData,
      calculationData,
      collapseTables,
      totalTables,
      orderNumber,
      orderNotes,
      customTemplateContent,
      templateName,
    ]);

    const handleGeneratePreview = useCallback(async () => {
      setLoadingPreview(true);
      setClickedPreview(true);
      setHtmlPreview(""); // Clear previous preview
      try {
        const payload = buildRequestPayload();
        const response = await authFetch("/api/v1/user/generate_html_table", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/plain", // Request HTML preview
          },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          const html = await response.text();
          setHtmlPreview(html);
          showMessage("success", str("HTML preview generated successfully!"));
        } else {
          const errorText = await response.text();
          console.error("Failed to generate preview:", errorText);
          showMessage(
            "error",
            `${str("Failed to generate preview:")} ${errorText}`,
          );
          setHtmlPreview(
            `<p style="color: red;">${str("Failed to generate preview:")} ${errorText}</p>`,
          );
        }
      } catch (error) {
        console.error("Error generating preview:", error);
        showMessage(
          "error",
          `${str("Error generating preview:")} ${error.message}`,
        );
        setHtmlPreview(
          `<p style="color: red;">${str("Error generating preview:")} ${error.message}</p>`,
        );
      } finally {
        setLoadingPreview(false);
      }
    }, [buildRequestPayload, showMessage, str]);

    const handleDownloadPdf = useCallback(async () => {
      setLoadingDownload(true);
      try {
        const payload = buildRequestPayload();
        const response = await authFetch("/api/v1/user/generate_pdf_table", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/pdf", // Request PDF for download
          },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `calculation_report_${Date.now()}.pdf`; // Dynamic filename
          document.body.appendChild(a);
          a.click();
          a.remove();
          window.URL.revokeObjectURL(url);
          showMessage("success", str("PDF downloaded successfully!"));
        } else {
          const errorText = await response.text();
          console.error("Failed to download PDF:", errorText);
          showMessage(
            "error",
            `${str("Failed to download PDF:")} ${errorText}`,
          );
        }
      } catch (error) {
        console.error("Error downloading PDF:", error);
        showMessage(
          "error",
          `${str("Error downloading PDF:")} ${error.message}`,
        );
      } finally {
        setLoadingDownload(false);
      }
    }, [buildRequestPayload, showMessage, str]);

    return (
      <div
        style={{ margin: "auto", maxWidth: "560px", paddingTop: "5pt" }}
        className="fade-in-simple"
      >
        <h4>{name}</h4>
        <Form fluid className="w-full">
          <Form.Group>
            <Form.ControlLabel>
              <Trans>Order Number</Trans>
            </Form.ControlLabel>
            <Input
              value={orderNumber}
              onChange={setOrderNumber}
              placeholder={str("Enter order number")}
            />
          </Form.Group>
          <Form.Group>
            <Form.ControlLabel>
              <Trans>Order Notes</Trans>
            </Form.ControlLabel>
            <Input
              as="textarea"
              rows={3}
              value={orderNotes}
              onChange={setOrderNotes}
              placeholder={str("Enter order notes")}
            />
          </Form.Group>
          <Form.Group>
            {name === "custom" && (
              <Panel
                header={str("Custom Template Content (Jinja2)")}
                collapsible
                bordered
              >
                <Input
                  as="textarea"
                  rows={8}
                  value={customTemplateContent}
                  onChange={setCustomTemplateContent}
                  placeholder={str(
                    "Enter custom template content here (e.g., HTML with placeholders)",
                  )}
                />
              </Panel>
            )}
          </Form.Group>
          <Stack
            spacing={10}
            wrap
            alignItems="center"
            justifyContent="center"
            style={{ width: "100%" }}
          >
            <Button
              appearance="primary"
              onClick={handleGeneratePreview}
              loading={loadingPreview}
              disabled={loadingDownload}
              startIcon={<File />}
              data-testid="print-generate-preview-button"
            >
              <Trans>Generate Preview</Trans>
            </Button>
            <Button
              appearance="green"
              onClick={handleDownloadPdf}
              loading={loadingDownload}
              disabled={loadingPreview}
              startIcon={<FileDown />}
              data-testid="print-download-pdf-button"
            >
              <Trans>Download PDF</Trans>
            </Button>
          </Stack>
        </Form>
        {clickedPreview && (
          <>
            <Divider>
              <Trans>Preview</Trans>
            </Divider>
            {loadingPreview && <Loader />}
            {!loadingPreview && htmlPreview && (
              <iframe
                title="Document Preview"
                className="pop-in-simple"
                data-testid="print-html-preview-iframe"
                style={{
                  width: "100%",
                  minHeight: "500px",
                  border: "1px solid #ddd",
                  backgroundColor: "white",
                }}
                srcDoc={htmlPreview}
              />
            )}
            {!loadingPreview && !htmlPreview && (
              <Message type="info" showIcon className="w-full">
                <Trans>Generate a preview to see it here.</Trans>
              </Message>
            )}
          </>
        )}
      </div>
    );
  },
);

const DocumentSelector = ({
  documents,
  selectedDocuments,
  setSelectedDocuments,
}) => {
  const handleCheckboxChange = (value, checked) => {
    if (checked) {
      setSelectedDocuments((prev) => [...prev, value]);
    } else {
      setSelectedDocuments((prev) => prev.filter((item) => item !== value));
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        alignContent: "center",
        maxWidth: "300pt",
        margin: "auto",
      }}
    >
      <h4>Оберіть тип документа</h4>
      {documents.map((doc) => (
        <Checkbox
          key={doc.value}
          value={doc.value}
          checked={
            isArrayLike(selectedDocuments) &&
            selectedDocuments.includes(doc.value)
          }
          onChange={(value, checked) =>
            handleCheckboxChange(doc.value, checked)
          }
          data-testid={`print-template-checkbox-${doc.value}`}
        >
          {doc.label}
        </Checkbox>
      ))}
      <Divider />
    </div>
  );
};

// Main Print Calculation Drawer Component
const PrintCalculationDrawer = React.memo(
  ({
    show,
    onClose,
    calculationData,
    collapseTables = false,
    totalTables = {},
    partsData,
    carData,
    orderData,
    paintData,
  }) => {
    const toaster = useToaster();
    const { str } = useLocale();
    const navigate = useNavigate();
    const isMobile = useMediaQuery({ maxWidth: 767 });
    const [selectedDocuments, setSelectedDocuments] = useState([]);
    const [templates, setTemplates] = useState([]);

    const showMessage = useCallback(
      (type, message) => {
        toaster.push(
          <Message type={type} closable duration={5000}>
            {message}
          </Message>,
          { placement: "topEnd" },
        );
      },
      [toaster],
    );

    const fetchList = useCallback(
      async (endpoint, setter) => {
        try {
          const response = await authFetch(endpoint);
          if (handleLicenseForbidden(navigate, response)) {
            return;
          }
          if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
          }
          const data = await response.json();
          setter([
            ...data.map((item) => {
              return {
                label: str(item.replace(".html", "")),
                value: item,
              };
            }),
            {
              label: "Свій шаблон",
              value: "custom",
            },
          ]);
        } catch (err) {
          showMessage("error", err.toString());
        }
      },
      [navigate, showMessage, str],
    );

    useEffect(() => {
      fetchList("/api/v1/user/list_templates", setTemplates);
    }, [fetchList]);

    return (
      <Drawer
        size={isMobile ? "full" : "lg"}
        placement={isMobile ? "top" : "right"}
        open={show}
        onClose={onClose}
        style={{ overflowY: "auto" }}
        data-testid="print-calculation-drawer"
      >
        <Drawer.Header>
          <Drawer.Title>
            <Trans>Print and Document Generation</Trans>
          </Drawer.Title>
          <Drawer.Actions></Drawer.Actions>
        </Drawer.Header>
        <Drawer.Body>
          <div>
            <DocumentSelector
              documents={templates}
              selectedDocuments={selectedDocuments}
              setSelectedDocuments={setSelectedDocuments}
            />
            {selectedDocuments.map((doc) => {
              return (
                <PrintDocumentGenerator
                  key={doc}
                  name={doc}
                  paintData={paintData}
                  calculationData={calculationData}
                  collapseTables={collapseTables}
                  totalTables={totalTables}
                  carData={carData}
                  partsData={partsData}
                  orderData={orderData}
                  templateName={doc == "custom" ? null : doc}
                />
              );
            })}
          </div>
        </Drawer.Body>
      </Drawer>
    );
  },
);

export default PrintCalculationDrawer;
