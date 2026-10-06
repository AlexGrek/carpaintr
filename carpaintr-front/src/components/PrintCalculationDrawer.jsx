/* eslint-disable react/display-name */
import { mcpApi } from "../utils/mcpApi";
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
} from "rsuite";
import { useMediaQuery } from "react-responsive";
import { useLocale, registerTranslations } from "../localization/LocaleContext";
import { authFetch, getCompanyInfo } from "../utils/authFetch";
import { handleLicenseForbidden } from "../utils/licenseRedirect";
// Added for Generate Preview button
import Trans from "../localization/Trans";
import { isArrayLike } from "lodash";
import { File, FileDown, Braces, Sheet, Check, FileCode2, FileStack } from "lucide-react";
import { buildCalculationOutput } from "../calc/calculationOutputs";
import { downloadCalculationExcel } from "../calc/excelExport";
import { getTemplateLabel } from "../calc/documentTemplates";
import "./PrintCalculationDrawer.css";

// Bundled thumbnail previews for the built-in document templates. Templates
// without an entry here (e.g. future additions, "custom") fall back to a
// generic icon placeholder in the card instead of a screenshot.
const DOCUMENT_PREVIEWS = {
  "calculation_ua.html": "/doc_previews/calculation_ua.png",
  "work_order_category_ua.html": "/doc_previews/work_order_category_ua.png",
};

registerTranslations("ua", {
  "Save and share PDF": "Зберегти та поширити PDF",
  "PDF saved. Manage its link in PDF history.": "PDF збережено. Керуйте посиланням в історії PDF.",
  "Saved PDF link (valid for 30 days)": "Посилання на збережений PDF (діє 30 днів)",
  "Show JSON payload": "Показати JSON-дані",
  "Hide JSON payload": "Сховати JSON-дані",
  "Generation JSON payload": "JSON-дані для генерації",
  "Download Excel": "Завантажити Excel",
  "Excel file downloaded successfully!": "Файл Excel успішно завантажено!",
  "Failed to build Excel file:": "Не вдалося створити файл Excel:",
  Calculation: "Розрахунок",
  "Work / Material": "Робота / Матеріал",
  "Norm-hours": "Нормо-години",
  Unit: "Од.",
  Subtotal: "Разом за категорією",
  "Computed subtotal": "Розрахована сума",
  "Difference": "Різниця",
  "Part totals": "Суми за деталями",
  "Grand total": "Загалом",
  "Work order by category": "Наряд за категоріями",
  "Custom template": "Свій шаблон",
  "Choose a document type": "Оберіть тип документа",
});

// Print Document Generator Component
const PrintDocumentGenerator = React.memo(
  ({
    name,
    title,
    calculationData,
    collapseTables = false,
    totalTables = {},
    categoryTables: resolvedCategoryTables,
    grandTotal,
    currency = "",
    onOrderChange,
    partsData: _partsData,
    carData,
    orderData,
    paintData,
    templateName,
  }) => {
    const { str } = useLocale();
    const toaster = useToaster();
    const [customTemplateContent, setCustomTemplateContent] = useState("");
    const [localOrderNumber, setLocalOrderNumber] = useState(orderData?.orderNumber ?? "");
    const [localOrderNotes, setLocalOrderNotes] = useState(orderData?.orderNotes ?? "");
    const orderNumber = onOrderChange ? orderData?.orderNumber ?? "" : localOrderNumber;
    const orderNotes = onOrderChange ? orderData?.orderNotes ?? "" : localOrderNotes;
    const setOrderNumber = (value) => onOrderChange
      ? onOrderChange({ ...orderData, orderNumber: value }) : setLocalOrderNumber(value);
    const setOrderNotes = (value) => onOrderChange
      ? onOrderChange({ ...orderData, orderNotes: value }) : setLocalOrderNotes(value);
    const [htmlPreview, setHtmlPreview] = useState("");
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [clickedPreview, setClickedPreview] = useState(false);
    const [loadingDownload, setLoadingDownload] = useState(false);
    const [loadingExcel, setLoadingExcel] = useState(false);
    const [savedPdf, setSavedPdf] = useState(null);
    const [savingPdf, setSavingPdf] = useState(false);
    const [showPayload, setShowPayload] = useState(false);

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
      const output = buildCalculationOutput({ calculations: calculationData, collapseTables,
        totalTables, categoryTables: resolvedCategoryTables, grandTotal, currency, str });

      return {
        calculation: {
          car: carData,
          paint: paintData,
          order: orderData,
          ...output,
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
      resolvedCategoryTables,
      grandTotal,
      currency,
      orderNumber,
      orderNotes,
      customTemplateContent,
      templateName,
      str,
    ]);

    // What the payload panel shows: the request body minus `template_name`,
    // which is a storage filename (e.g. "calculation_ua.html") and must not
    // surface in the UI. It is still sent to the backend unchanged.
    const buildDisplayedPayload = useCallback(() => {
      const { template_name: _templateName, ...displayed } =
        buildRequestPayload();
      return displayed;
    }, [buildRequestPayload]);

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

    const handleSavePdf = useCallback(async () => {
      setSavingPdf(true);
      try {
        let pdf = await mcpApi('/api/v1/pdfs', { method: 'POST', body: buildRequestPayload() });
        if (!pdf.public_url) pdf = await mcpApi(`/api/v1/pdfs/${pdf.document_id}/share`, { method: 'POST' });
        setSavedPdf(pdf);
      } catch (error) { showMessage('error', error.message); }
      finally { setSavingPdf(false); }
    }, [buildRequestPayload, showMessage]);

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

    const handleDownloadExcel = useCallback(async () => {
      setLoadingExcel(true);
      try {
        // Always built from the raw per-part calculations: the Excel sheet is
        // grouped by category, not by the on-screen collapsed/detailed choice.
        await downloadCalculationExcel({
          calculations: calculationData,
          categoryTables: resolvedCategoryTables,
          totalTables,
          grandTotal,
          currency,
          str,
          fileName: `calculation_${orderNumber || Date.now()}.xlsx`,
        });
        showMessage("success", str("Excel file downloaded successfully!"));
      } catch (error) {
        console.error("Error building Excel file:", error);
        showMessage(
          "error",
          `${str("Failed to build Excel file:")} ${error.message}`,
        );
      } finally {
        setLoadingExcel(false);
      }
    }, [calculationData, resolvedCategoryTables, totalTables, grandTotal, currency, orderNumber, showMessage, str]);

    return (
      <div
        style={{ margin: "auto", maxWidth: "560px", paddingTop: "5pt" }}
        className="fade-in-simple"
      >
        <h4>{title}</h4>
        <Form fluid className="w-full">
          <Form.Group>
            <Form.ControlLabel>
              <Trans>Order Number</Trans>
            </Form.ControlLabel>
            <Input
              data-testid="print-order-number-input"
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
              data-testid="print-order-notes-input"
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
                  data-testid="print-custom-template-input"
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
            <Button data-testid="print-save-share-pdf-button" loading={savingPdf} disabled={loadingPreview || loadingDownload} onClick={handleSavePdf}>
              <Trans>Save and share PDF</Trans>
            </Button>
            {savedPdf && <Message type="info">
              <Trans>{savedPdf.public_url ? "Saved PDF link (valid for 30 days)" : "PDF saved. Manage its link in PDF history."}</Trans>
              {savedPdf.public_url && <a data-testid="print-saved-pdf-link" href={savedPdf.public_page_url || savedPdf.public_url} rel="noreferrer" style={{ display: 'block', overflowWrap: 'anywhere' }}>{savedPdf.public_page_url || savedPdf.public_url}</a>}
              <a data-testid="print-pdf-history-link" href="/app/history"><Trans>History</Trans></a>
            </Message>}
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
            <Button
              appearance="ghost"
              onClick={handleDownloadExcel}
              loading={loadingExcel}
              disabled={loadingPreview || loadingDownload}
              startIcon={<Sheet />}
              data-testid="print-download-excel-button"
            >
              <Trans>Download Excel</Trans>
            </Button>
            <Button
              appearance="subtle"
              onClick={() => setShowPayload((prev) => !prev)}
              startIcon={<Braces />}
              data-testid="print-toggle-payload-button"
            >
              {showPayload ? (
                <Trans>Hide JSON payload</Trans>
              ) : (
                <Trans>Show JSON payload</Trans>
              )}
            </Button>
          </Stack>
        </Form>
        {showPayload && (
          <Panel
            header={str("Generation JSON payload")}
            bordered
            style={{ marginTop: "10pt", textAlign: "left" }}
            data-testid="print-payload-panel"
          >
            <pre
              data-testid="print-payload-json"
              style={{
                maxHeight: "400px",
                overflow: "auto",
                fontSize: "12px",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                margin: 0,
              }}
            >
              {JSON.stringify(buildDisplayedPayload(), null, 2)}
            </pre>
          </Panel>
        )}
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
  const { str } = useLocale();
  const handleToggle = (value, checked) => {
    if (checked) {
      setSelectedDocuments((prev) => [...prev, value]);
    } else {
      setSelectedDocuments((prev) => prev.filter((item) => item !== value));
    }
  };

  return (
    <div className="doc-selector">
      <h4 className="doc-selector__title">{str("Choose a document type")}</h4>
      <div className="doc-grid">
        {documents.map((doc) => {
          const selected =
            isArrayLike(selectedDocuments) &&
            selectedDocuments.includes(doc.value);
          const previewSrc = DOCUMENT_PREVIEWS[doc.value];
          const isCustom = doc.value === "custom";

          return (
            <div
              key={doc.value}
              role="checkbox"
              aria-checked={selected}
              tabIndex={0}
              className={`doc-card${selected ? " doc-card--selected" : ""}`}
              onClick={() => handleToggle(doc.value, !selected)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleToggle(doc.value, !selected);
                }
              }}
              data-testid={`print-template-card-${doc.value}`}
            >
              <div className="doc-card__thumb">
                {previewSrc ? (
                  <img src={previewSrc} alt={doc.label} loading="lazy" />
                ) : (
                  <div className="doc-card__placeholder">
                    {isCustom ? (
                      <FileCode2 size={36} strokeWidth={1.5} />
                    ) : (
                      <FileStack size={36} strokeWidth={1.5} />
                    )}
                  </div>
                )}
                <div className="doc-card__badge">
                  <Check size={16} strokeWidth={3} />
                </div>
              </div>
              <div className="doc-card__label">{doc.label}</div>
            </div>
          );
        })}
      </div>
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
    categoryTables: resolvedCategoryTables,
    grandTotal,
    currency: savedCurrency,
    onOrderChange,
    partsData,
    carData,
    orderData,
    paintData,
  }) => {
    const currency = savedCurrency ?? getCompanyInfo()?.pricing_preferences?.norm_price?.currency ?? "";
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
            ...data.map((item) => ({
              label: getTemplateLabel(item, str),
              value: item,
            })),
            {
              label: str("Custom template"),
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
                  title={
                    doc === "custom"
                      ? str("Custom template")
                      : getTemplateLabel(doc, str)
                  }
                  paintData={paintData}
                  calculationData={calculationData}
                  collapseTables={collapseTables}
                  totalTables={totalTables}
                  categoryTables={resolvedCategoryTables}
                  grandTotal={grandTotal}
                  currency={currency}
                  onOrderChange={onOrderChange}
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
