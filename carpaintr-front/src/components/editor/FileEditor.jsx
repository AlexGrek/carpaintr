// FileEditor.jsx
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Button, Input, IconButton, Notification, ButtonToolbar, Drawer, Table, Tag } from 'rsuite';
import { Edit, Save, X, Trash2, ScrollText, Pencil, Download, AlertTriangle, ChevronDown, Upload, CheckCheck } from 'lucide-react';
import styled from 'styled-components';
import { authFetch } from '../../utils/authFetch';
import * as yaml from 'js-yaml';
import Papa from 'papaparse';
import { useLocale, registerTranslations } from '../../localization/LocaleContext';
import Trans from '../../localization/Trans';
import TableEditorChatGPT from './TableEditorChatGPT';
import YamlItemsEditorDrawer from './YamlItemsEditorDrawer';
import { isArrayLike } from 'lodash';

// Register translations for FileEditor
registerTranslations("ua", {
  "Download File": "Завантажити файл",
  "Delete File": "Видалити файл",
  "Close": "Закрити",
  "Loading file content...": "Завантаження вмісту файлу...",
  "Click Edit to modify": "Натисніть Редагувати, щоб змінити",
  "Edit as text": "Редагувати як текст",
  "Save": "Зберегти",
  "Cancel": "Скасувати",
  "Edit": "Редагувати",
  "Open table editor": "Відкрити редактор таблиць",
  "Open YAML editor (broken now)": "Відкрити YAML редактор (зараз не працює)",
  "Confirm Deletion": "Підтвердити видалення",
  "Are you sure you want to delete the file": "Ви впевнені, що хочете видалити файл",
  "This action cannot be undone.": "Цю дію неможливо скасувати.",
  "Delete Permanently": "Видалити назавжди",
  "Permission Denied": "Дозвіл відхилено",
  "Cannot delete common files.": "Неможливо видалити загальні файли.",
  "File not deleted:": "Файл не видалено:",
  "Failed to delete file:": "Не вдалося видалити файл:",
  "File deleted": "Файл видалено",
  "Failed to load file content:": "Не вдалося завантажити вміст файлу:",
  "Validation Error": "Помилка валідації",
  "Invalid file format:": "Недійсний формат файлу:",
  "Save Error": "Помилка збереження",
  "File not saved:": "Файл не збережено:",
  "Failed to save file:": "Не вдалося зберегти файл:",
  "File saved": "Файл збережено",
  "Network Error": "Помилка мережі",
  "No file path": "Немає шляху до файлу",
  "More rows...": "Більше рядків...",
  "Upload File": "Завантажити файл",
  "Validate": "Перевірити",
  "Validation result:": "Результат перевірки",
  "Validation successful, no issues detected": "Проблем не знайдено",
  "Fix complete, now refresh the page! Done:": "Виконано, тепер оновіть сторінку! Знайдено:",
  "Refresh": "Оновити сторінку",
  "Try to fix on server": "Застосувати автоматичні виправлення"
});


const FileEditorContainer = styled.div`
  padding: 20px;
  background-color: #fff;
  border: 1px solid #e5e5ea;
  border-radius: 8px;
  height: 90%;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
  position: relative;

  ${props => props.dragActive && `
    border: 2px dashed #1a73e8;
    background-color: #e8f0fe;
  `}
`;

const Header = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  padding-bottom: 10px;
  border-bottom: 1px solid #f0f0f0;
`;

const Title = styled.h3`
  margin: 0;
  color: #333;
`;

const ContentArea = styled.div`
  flex-grow: 1;
  margin-bottom: 15px;
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 0;
  text-align: left;
`;

const PreviewContainer = styled.div`
  position: relative;
  max-height: 100%;
  overflow: hidden;
  padding: 10px;
  border: 1px solid #e5e5ea;
  border-radius: 6px;
  background-color: #f9f9f9;
  font-family: "Consolas", monospace;
  font-size: smaller;
  white-space: pre-wrap;
  word-wrap: break-word;
  flex-grow: 1;
`;

const TablePreviewContainer = styled.div`
  position: relative;
  max-height: 100%;
  overflow: auto;
  border: 1px solid #e5e5ea;
  border-radius: 6px;
  background-color: #fff;
  flex-grow: 1;

  .rs-table {
    font-size: 13px;
  }

  .rs-table-cell-content {
    padding: 8px 12px;
  }

  .more-rows-indicator {
    color: #999;
    font-style: italic;
    text-align: center;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
  }
`;

const FadeOverlay = styled.div`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 80px;
  background: linear-gradient(to top, #f9f9f9 0%, rgba(255, 255, 255, 0) 100%);
  pointer-events: none;
`;

const Overlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(255, 255, 255, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 1.2em;
  color: #666;
  z-index: 10;
  cursor: not-allowed;
  border-radius: 6px;
`;

const Footer = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  padding-top: 10px;
  border-top: 1px solid #f0f0f0;
  flex-shrink: 0;
`;

const HeaderActions = styled.div`
  display: flex;
  gap: 10px;
  align-items: center;
`;

const { Column, HeaderCell, Cell } = Table;

const FileEditor = ({
  fileName,
  filePath,
  isCommonFile,
  onClose,
  onSaveSuccess,
  onDeleteSuccess,
  readEndpoint,
  validateEndpoint = null,
  fixEndpoint = null,
  uploadEndpoint,
  deleteEndpoint
}) => {
  const [fileContent, setFileContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [loadingContent, setLoadingContent] = useState(true);
  const [isViewingPreview, setIsViewingPreview] = useState(true);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const [tableEditorOpen, setTableEditorOpen] = useState(false);
  const [yamlEditorOpen, setYamlEditorOpen] = useState(false);

  const [msg, setMsg] = useState(null);
  const { str } = useLocale();

  const fileInputRef = useRef(null);

  // Parse CSV data for table preview
  const csvData = useMemo(() => {
    if (!filePath || !filePath.endsWith('.csv') || !fileContent) {
      return null;
    }

    try {
      const parsed = Papa.parse(fileContent, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false,
        delimitersToGuess: [',', '\t', '|', ';']
      });

      if (parsed.errors && parsed.errors.length > 0) {
        console.warn('CSV parsing warnings:', parsed.errors);
      }

      return parsed.data;
    } catch (error) {
      console.error('Error parsing CSV:', error);
      return null;
    }
  }, [filePath, fileContent]);

  // Prepare table data with truncation
  const tableData = useMemo(() => {
    if (!csvData || csvData.length === 0) return null;

    const maxRows = 10;
    let displayData = csvData.slice(0, maxRows);

    // Add indicator row if there are more rows
    if (csvData.length > maxRows) {
      const headers = Object.keys(csvData[0] || {});
      const indicatorRow = {};
      headers.forEach(header => {
        indicatorRow[header] = '⋯';
      });
      displayData.push(indicatorRow);
    }

    return {
      data: displayData,
      headers: Object.keys(csvData[0] || {}),
      hasMore: csvData.length > maxRows,
      totalRows: csvData.length
    };
  }, [csvData]);

  const handleFix = useCallback(() => {
    const fetchFileContent = async () => {
      setMsg(null);
      setLoadingContent(true);
      try {
        const response = await authFetch(`/api/v1/${fixEndpoint}/${encodeURIComponent(filePath)}`);
        if (!response.ok) {
          throw new Error(str(`Bad response: ${response.statusText}`));
        }
        const content = await response.json();
        if (isArrayLike(content) && content.length > 0) {
          const distinct = [...new Set(content)];
          setMsg(<Notification type='warning' header={str("Fix complete, now refresh the page! Done:") + ` ${content.length} errors, ${distinct.length} unique`}>
            <div style={{ maxHeight: '3em', overflowY: 'auto', display: 'block' }}>{distinct.map(item => <Tag key={item}>{item}</Tag>)}</div>
            <br />
            <Button appearance='primary' color='green' onClick={() => window.location.reload()}><Trans>Refresh</Trans></Button>
          </Notification>)
        } else {
          setMsg(<Notification type="success" header={str("Validation result:")}>{str("Validation successful, no issues detected")}</Notification>, { placement: 'topEnd' });
        }
      } catch (err) {
        setMsg(<Notification type="error" header={str("Error")}>{str("Failed to load file validation result:")} {err.message}</Notification>, { placement: 'topEnd' });
      } finally {
        setLoadingContent(false);
      }
    };

    if (filePath && fixEndpoint) {
      fetchFileContent();
    }
  }, [filePath, str, fixEndpoint]);

  const handleValidate = useCallback(() => {
    const fetchFileContent = async () => {
      setMsg(null);
      setLoadingContent(true);
      try {
        const response = await authFetch(`/api/v1/${validateEndpoint}/${encodeURIComponent(filePath)}`);
        if (!response.ok) {
          throw new Error(str(`Bad response: ${response.statusText}`));
        }
        const content = await response.json();
        if (isArrayLike(content) && content.length > 0) {
          const distinct = [...new Set(content)];
          setMsg(<Notification type='warning' header={str("Validation result:") + ` ${content.length} errors, ${distinct.length} unique`}>
            <div style={{ maxHeight: '6em', overflowY: 'auto' }}>{distinct.map(item => <Tag key={item}>{item}</Tag>)}</div>
            <br />
            <Button appearance='ghost' onClick={handleFix}><Trans>Try to fix on server</Trans></Button>
          </Notification>)
        } else {
          setMsg(<Notification type="success" header={str("Validation result:")}>{str("Validation successful, no issues detected")}</Notification>, { placement: 'topEnd' });
        }
      } catch (err) {
        setMsg(<Notification type="error" header={str("Error")}>{str("Failed to load file validation result:")} {err.message}</Notification>, { placement: 'topEnd' });
      } finally {
        setLoadingContent(false);
      }
    };

    if (filePath && validateEndpoint) {
      fetchFileContent();
    }
  }, [filePath, handleFix, str, validateEndpoint]);

  useEffect(() => {
    const fetchFileContent = async () => {
      setMsg(null);
      setLoadingContent(true);
      try {
        const response = await authFetch(`/api/v1/${readEndpoint}/${encodeURIComponent(filePath)}`);
        if (!response.ok) {
          throw new Error(str(`Failed to read file: ${response.statusText}`));
        }
        const content = await response.text();
        setFileContent(content);
        setOriginalContent(content);
      } catch (err) {
        setMsg(<Notification type="error" header={str("Error")}>{str("Failed to load file content:")} {err.message}</Notification>, { placement: 'topEnd' });
        setFileContent('');
        setOriginalContent('');
      } finally {
        setLoadingContent(false);
        setIsEditing(false);
        setIsViewingPreview(true);
      }
    };

    if (filePath && readEndpoint) {
      fetchFileContent();
    }
  }, [filePath, readEndpoint, str]);

  const validateContent = useCallback((saveValue) => {
    if (!saveValue) {
      saveValue = fileContent
    }
    // Only validate if filePath is provided, otherwise assume it's new content not yet associated with a specific type
    if (filePath) {
      if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
        try { yaml.load(saveValue); return null; } catch (e) {
          return e.message;
        }
      }
      if (filePath.endsWith('.json')) {
        try { JSON.parse(saveValue); return null; } catch (e) { return e.message; }
      }
    }
    return null; // No validation needed if no filePath or it's a generic text file
  }, [filePath, fileContent]);

  const handleSave = useCallback(async (saveValue) => {
    setMsg(null);
    if (!filePath) {
      setMsg(<Notification type="error" header={str("Save Error")}>{str("No file path provided to save to.")}</Notification>, { placement: 'topEnd' });
      return;
    }

    if (!saveValue) {
      saveValue = fileContent;
    }
    let validationError = validateContent(saveValue);
    if (validationError) {
      setMsg(<Notification type="error" header={str("Validation Error")}>{str("Invalid file format:")} {validationError}</Notification>, { placement: 'topEnd' });
      return;
    }

    const formData = new FormData();
    formData.append('file', new Blob([saveValue]), fileName);
    if (saveValue === "[object Object]") { // Check for accidental object stringification
      setMsg(<Notification type="error" header={str("Save Error")}>File corrupted by frontend</Notification>, { placement: 'topEnd' });
      return;
    }
    try {
      setMsg(null);
      const response = await authFetch(`/api/v1/${uploadEndpoint}/${encodeURIComponent(filePath)}`, {
        method: 'POST',
        body: formData
      });
      if (!response.ok) {
        const errorData = await response.json();
        setMsg(<Notification type="error" header={str("Save Error")}>{str("File not saved:")} {errorData.message || JSON.stringify(errorData)}</Notification>, { placement: 'topEnd' });
      } else {
        setOriginalContent(fileContent); // Update originalContent after successful save
        setMsg(<Notification type="success" header={str("Success")}>{str("File saved")}</Notification>, { placement: 'topEnd' });
        setIsEditing(false);
        if (onSaveSuccess) onSaveSuccess();
      }
    } catch (error) {
      setMsg(<Notification type="error" header={str("Network Error")}>{str("Failed to save file:")} {error.message}</Notification>, { placement: 'topEnd' });
    }
  }, [fileContent, filePath, fileName, validateContent, uploadEndpoint, onSaveSuccess, str]);


  const handleDelete = useCallback(async () => {
    setShowDeleteConfirmation(false);
    setMsg(null);
    if (isCommonFile) {
      setMsg(<Notification type="warning" header={str("Permission Denied")}>{str("Cannot delete common files.")}</Notification>, { placement: 'topEnd' });
      return;
    }
    if (!filePath) { // Cannot delete if there's no file path to begin with
      setMsg(<Notification type="warning" header={str("Warning")}>No file selected to delete.</Notification>, { placement: 'topEnd' });
      return;
    }
    try {
      const response = await authFetch(`/api/v1/${deleteEndpoint}/${encodeURIComponent(filePath)}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorData = await response.json();
        setMsg(<Notification type="error" header={str("Delete Error")}>{str("File not deleted:")} {errorData.message || JSON.stringify(errorData)}</Notification>, { placement: 'topEnd' });
      } else {
        setMsg(<Notification type="success" header={str("Success")}>{str("File deleted")}</Notification>, { placement: 'topEnd' });
        if (onDeleteSuccess) onDeleteSuccess();
        onClose();
      }
    } catch (error) {
      setMsg(<Notification type="error" header={str("Network Error")}>{str("Failed to delete file:")} {error.message}</Notification>, { placement: 'topEnd' });
    }
  }, [filePath, isCommonFile, onDeleteSuccess, deleteEndpoint, onClose, str]);

  const handleCancelEdit = useCallback(() => {
    setMsg(null);
    setFileContent(originalContent);
    setIsEditing(false);
  }, [originalContent]);

  const handleEditAsText = useCallback(() => {
    setMsg(null);
    setIsViewingPreview(false);
    setIsEditing(true);
  }, []);

  const handleDownload = useCallback(() => {
    setMsg(null);
    var fileType = 'text/plain';
    if (fileName.endsWith(".yaml") || fileName.endsWith(".yml")) {
      fileType = 'application/x-yaml;charset=utf-8;';
    }
    if (fileName.endsWith(".csv")) {
      fileType = 'text/csv;charset=utf-8;';
    }
    if (fileName.endsWith(".json")) {
      fileType = 'application/json;charset=utf-8;';
    }
    const blob = new Blob([fileContent], { type: fileType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    setMsg(<Notification type="info" header={str("Download File")}>{fileName}</Notification>, { placement: 'topEnd' });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [fileContent, fileName, str]);

  const handleContentChange = useCallback((value) => {
    setFileContent(value);
  }, []);

  // Now, hasUnsavedChanges will correctly reflect if the current fileContent is different from originalContent
  const hasUnsavedChanges = fileContent !== originalContent;

  const handleOpenTableEditor = useCallback(() => {
    setTableEditorOpen(true);
  }, []);

  const handleOpenYamlEditor = useCallback(() => {
    setYamlEditorOpen(true);
  }, []);

  const isCSVFile = filePath && filePath.endsWith('.csv');

  const handleFileRead = useCallback((file) => {
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target.result;
        setFileContent(content);
        setOriginalContent('');
        setIsEditing(true); // Enter edit mode
        setIsViewingPreview(false); // Show as text
        setMsg(null); // Clear any existing messages
      };
      reader.onerror = () => {
        setMsg(<Notification type="error" header={str("Error")}>Failed to read file.</Notification>, { placement: 'topEnd' });
      };
      reader.readAsText(file);
    }
  }, [str]);

  const handleFileInputChange = useCallback((e) => {
    const file = e.target.files[0];
    handleFileRead(file);
    e.target.value = null; // Clear the input value
  }, [handleFileRead]);

  const handleUploadClick = useCallback(() => {
    fileInputRef.current.click();
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isViewingPreview && !isEditing) {
      setDragActive(true);
    }
  }, [isViewingPreview, isEditing]);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0 && isViewingPreview && !isEditing) {
      handleFileRead(e.dataTransfer.files[0]);
    }
  }, [handleFileRead, isViewingPreview, isEditing]);


  return (
    <FileEditorContainer
      dragActive={dragActive}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <Header>
        <Title>{fileName}</Title>
        <HeaderActions>
          <IconButton icon={<Download />} onClick={handleDownload} appearance="subtle" title={str("Download File")} />
          <IconButton icon={<Upload />} onClick={handleUploadClick} appearance="subtle" title={str("Upload File")} />
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileInputChange}
            style={{ display: 'none' }}
          />
          <IconButton
            icon={<Trash2 />}
            onClick={() => setShowDeleteConfirmation(true)}
            appearance="subtle"
            color="red"
            title={str("Delete File")}
            disabled={!filePath || isCommonFile || loadingContent || isEditing}
          />
          <IconButton icon={<X />} onClick={onClose} appearance="subtle" title={str("Close")} />
        </HeaderActions>
      </Header>

      <ContentArea>
        {msg}
        {loadingContent ? (
          <Overlay><Trans>Loading file content...</Trans></Overlay>
        ) : (
          isViewingPreview ? (
            isCSVFile && tableData && tableData.headers.length > 0 ? (
              <TablePreviewContainer>
                <Table
                  data={tableData.data}
                  height={400}
                  bordered
                  cellBordered
                  headerHeight={40}
                  rowHeight={35}
                >
                  {tableData.headers.map((header, index) => (
                    <Column key={index} flexGrow={1} minWidth={120}>
                      <HeaderCell>{header}</HeaderCell>
                      <Cell>
                        {(rowData, rowIndex) => {
                          const value = rowData[header];
                          const isIndicatorRow = tableData.hasMore && rowIndex === tableData.data.length - 1;

                          if (isIndicatorRow) {
                            return (
                              <div className="more-rows-indicator">
                                <ChevronDown size={14} />
                                <Trans>More rows...</Trans>
                              </div>
                            );
                          }

                          return (
                            <span title={value}>
                              {value}
                            </span>
                          );
                        }}
                      </Cell>
                    </Column>
                  ))}
                </Table>
                {tableData.hasMore && (
                  <div style={{
                    padding: '10px',
                    textAlign: 'center',
                    color: '#666',
                    fontSize: '13px',
                    borderTop: '1px solid #e5e5ea'
                  }}>
                    Showing {Math.min(10, tableData.totalRows)} of {tableData.totalRows} rows
                  </div>
                )}
              </TablePreviewContainer>
            ) : (
              <PreviewContainer>
                {fileContent}
                <FadeOverlay />
              </PreviewContainer>
            )
          ) : (
            <>
              {!isEditing && <Overlay><Trans>Click Edit to modify</Trans></Overlay>}
              <Input
                style={{
                  fontFamily: 'Consolas, monospace',
                  fontSize: 'smaller',
                  resize: 'auto',
                  height: '100%'
                }}
                value={fileContent}
                as="textarea"
                rows={20}
                onChange={handleContentChange}
                disabled={!isEditing || !filePath}
              />
            </>
          )
        )}
      </ContentArea>

      <Footer>
        <ButtonToolbar>
          {isViewingPreview ? (
            <Button appearance="primary" onClick={handleEditAsText} disabled={loadingContent}>
              <Pencil style={{ marginRight: 5 }} /> <Trans>Edit as text</Trans>
            </Button>
          ) : (
            <>
              {isEditing ? (
                <>
                  <Button appearance="primary" onClick={() => handleSave()} disabled={!filePath || !hasUnsavedChanges || loadingContent}>
                    <Save style={{ marginRight: 5 }} /> <Trans>Save</Trans>
                  </Button>
                  <Button appearance="subtle" onClick={handleCancelEdit} disabled={loadingContent}>
                    <X style={{ marginRight: 5 }} /> <Trans>Cancel</Trans>
                  </Button>
                </>
              ) : (
                <Button appearance="primary" onClick={() => setIsEditing(true)} disabled={loadingContent}>
                  <Edit style={{ marginRight: 5 }} /> <Trans>Edit</Trans>
                </Button>
              )}
            </>
          )}
        </ButtonToolbar>

        <ButtonToolbar>
          {isViewingPreview && (
            <>
              {filePath && filePath.endsWith(".csv") && (
                <>
                  <Button appearance="subtle" onClick={handleOpenTableEditor} disabled={isEditing}>
                    <ScrollText style={{ marginRight: 5 }} /> <Trans>Open table editor</Trans>
                  </Button>
                  {validateEndpoint && <Button appearance="subtle" onClick={handleValidate} disabled={isEditing}>
                    <CheckCheck style={{ marginRight: 5 }} /> <Trans>Validate</Trans>
                  </Button>}
                  <TableEditorChatGPT open={tableEditorOpen} onClose={() => setTableEditorOpen(false)} onSave={async (value) => {
                    setFileContent(value);
                    await handleSave(value);
                  }} fileName={fileName} csvData={fileContent} />
                </>
              )}
              {filePath && (filePath.endsWith(".yaml") || filePath.endsWith(".yml")) && (
                <>
                  <Button appearance="subtle" onClick={handleOpenYamlEditor} disabled={isEditing}>
                    <ScrollText style={{ marginRight: 5 }} /> <Trans>Open items editor</Trans>
                  </Button>
                  <YamlItemsEditorDrawer isOpen={yamlEditorOpen} onClose={() => setYamlEditorOpen(false)} onChange={async (value) => {
                    setFileContent(value);
                    await handleSave(value);
                  }} value={fileContent} />
                </>
              )}
            </>
          )}
        </ButtonToolbar>
      </Footer>

      <Drawer
        backdrop={true}
        placement="bottom"
        open={showDeleteConfirmation}
        onClose={() => setShowDeleteConfirmation(false)}
        size="xs"
      >
        <Drawer.Header>
          <Drawer.Title><AlertTriangle color="orange" style={{ marginRight: 10 }} /> <Trans>Confirm Deletion</Trans></Drawer.Title>
        </Drawer.Header>
        <Drawer.Body>
          <p><Trans>Are you sure you want to delete the file</Trans> <strong>&quot;{fileName}&quot;</strong>?</p>
          <Button onClick={handleDelete} appearance="primary" color="red">
            <Trash2 style={{ marginRight: 5 }} /> <Trans>Delete Permanently</Trans>
          </Button>
          <Button onClick={() => setShowDeleteConfirmation(false)} appearance="subtle">
            <Trans>Cancel</Trans>
          </Button>
        </Drawer.Body>
      </Drawer>
    </FileEditorContainer>
  );
};

export default FileEditor;