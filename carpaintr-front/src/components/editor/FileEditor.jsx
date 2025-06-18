// FileEditor.jsx
import { useState, useEffect, useCallback } from 'react';
import { Button, Input, IconButton, Notification, ButtonToolbar, Drawer } from 'rsuite'; // Added Drawer, Placeholder
import { Edit, Save, X, Trash2, Code, ScrollText, Pencil, Download, AlertTriangle } from 'lucide-react'; // Added Download, AlertTriangle
import styled from 'styled-components';
import { authFetch } from '../../utils/authFetch';
import * as yaml from 'js-yaml'; // Uncomment if js-yaml is installed
// import TableEditorChatGPT from './TableEditorChatGPT'; // Uncomment if these components exist
// import DrawerYamlEditor from './DrawerYamlEditor'; // Uncomment if these components exist


const FileEditorContainer = styled.div`
  padding: 20px;
  background-color: #fff;
  border: 1px solid #e5e5ea;
  border-radius: 8px;
  height: 100%;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
`;

const Header = styled.div`
  display: flex;
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
  flex-grow: 1; /* Allows content area to take available space */
  margin-bottom: 15px;
  position: relative; /* For overlay */
  display: flex; /* Ensures content inside is also flexible */
  flex-direction: column; /* Stacks children vertically if needed */
  min-height: 0; /* Important for flex-grow to work correctly with overflow */
  text-align: left;
`;

const PreviewContainer = styled.div`
  position: relative;
  max-height: 100%; /* Ensure it fits within ContentArea's height */
  overflow: hidden; /* Truncate content */
  padding: 10px;
  border: 1px solid #e5e5ea;
  border-radius: 6px;
  background-color: #f9f9f9;
  font-family: "Consolas", monospace;
  font-size: smaller;
  white-space: pre-wrap; /* Preserve whitespace and wrap text */
  word-wrap: break-word; /* Break long words */
  flex-grow: 1; /* Allow preview to grow */
`;

const FadeOverlay = styled.div`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 80px; /* Height of the fade effect */
  background: linear-gradient(to top, #f9f9f9 0%, rgba(255, 255, 255, 0) 100%);
  pointer-events: none; /* Allows clicks to pass through to content below if needed */
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
  justify-content: space-between;
  align-items: center;
  padding-top: 10px;
  border-top: 1px solid #f0f0f0;
  flex-shrink: 0; /* Prevent footer from shrinking */
`;

const HeaderActions = styled.div`
  display: flex;
  gap: 10px; /* Space between buttons */
  align-items: center;
`;

const FileEditor = ({
  fileName,
  filePath,
  isCommonFile,
  onClose,
  onSaveSuccess,
  onDeleteSuccess,
  readEndpoint,
  uploadEndpoint,
  deleteEndpoint
}) => {
  const [fileContent, setFileContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [loadingContent, setLoadingContent] = useState(true);
  const [isViewingPreview, setIsViewingPreview] = useState(true); // New state for preview mode
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false); // State for delete confirmation drawer

  const [tableEditorOpen, setTableEditorOpen] = useState(false);
  const [yamlEditorOpen, setYamlEditorOpen] = useState(false);

  const [msg, setMsg] = useState(null);

  useEffect(() => {
    const fetchFileContent = async () => {
      setMsg(null);
      setLoadingContent(true);
      try {
        const response = await authFetch(`/api/v1/${readEndpoint}/${encodeURIComponent(filePath)}`);
        if (!response.ok) {
          throw new Error(`Failed to read file: ${response.statusText}`);
        }
        const content = await response.text();
        setFileContent(content);
        setOriginalContent(content);
      } catch (err) {
        setMsg(<Notification type="error" header="Error">Failed to load file content: {err.message}</Notification>, { placement: 'topEnd' });
        setFileContent('');
        setOriginalContent('');
      } finally {
        setLoadingContent(false);
        setIsEditing(false); // Not editing initially
        setIsViewingPreview(true); // Start in preview mode
      }
    };

    if (filePath && readEndpoint) {
      fetchFileContent();
    }
  }, [filePath, readEndpoint]);


  const validateContent = useCallback(() => {
    if (!filePath) return "No file path";
    if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
      try { yaml.load(fileContent); return null; } catch (e) { 
        return e.message; 
      }
    }
    if (filePath.endsWith('.json')) {
      try { JSON.parse(fileContent); return null; } catch (e) { return e.message; }
    }
    return null;
  }, [filePath, fileContent]);

  const handleSave = useCallback(async () => {
    setMsg(null);
    let validationError = validateContent();
    if (validationError) {
      setMsg(<Notification type="error" header="Validation Error">Invalid file format: {validationError}</Notification>, { placement: 'topEnd' });
      return;
    }

    const formData = new FormData();
    formData.append('file', new Blob([fileContent]), fileName);
    try {
      setMsg(null);
      const response = await authFetch(`/api/v1/${uploadEndpoint}/${encodeURIComponent(filePath)}`, {
        method: 'POST',
        body: formData
      });
      if (!response.ok) {
        const errorData = await response.json();
        setMsg(<Notification type="error" header="Save Error">File not saved: {errorData.message || JSON.stringify(errorData)}</Notification>, { placement: 'topEnd' });
      } else {
        setOriginalContent(fileContent);
        setMsg(<Notification type="success" header="Success">File saved</Notification>, { placement: 'topEnd' });
        setIsEditing(false); // Exit edit mode after saving
        if (onSaveSuccess) onSaveSuccess();
      }
    } catch (error) {
      setMsg(<Notification type="error" header="Network Error">Failed to save file: {error.message}</Notification>, { placement: 'topEnd' });
    }
  }, [fileContent, filePath, fileName, validateContent, uploadEndpoint, onSaveSuccess]);


  const handleDelete = useCallback(async () => {
    setShowDeleteConfirmation(false); // Close the drawer
    setMsg(null);
    if (isCommonFile) {
      setMsg(<Notification type="warning" header="Permission Denied">Cannot delete common files.</Notification>, { placement: 'topEnd' });
      return;
    }
    try {
      const response = await authFetch(`/api/v1/${deleteEndpoint}/${encodeURIComponent(filePath)}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorData = await response.json();
        setMsg(<Notification type="error" header="Delete Error">File not deleted: {errorData.message || JSON.stringify(errorData)}</Notification>, { placement: 'topEnd' });
      } else {
        setMsg(<Notification type="success" header="Success">File deleted</Notification>, { placement: 'topEnd' });
        if (onDeleteSuccess) onDeleteSuccess();
        onClose(); // Close the editor after deletion
      }
    } catch (error) {
      setMsg(<Notification type="error" header="Network Error">Failed to delete file: {error.message}</Notification>, { placement: 'topEnd' });
    }
  }, [filePath, isCommonFile, onDeleteSuccess, deleteEndpoint, onClose]);

  const handleCancelEdit = useCallback(() => {
    setMsg(null);
    setFileContent(originalContent); // Revert to original content
    setIsEditing(false); // Exit edit mode
  }, [originalContent]);

  const handleEditAsText = useCallback(() => {
    setMsg(null);
    setIsViewingPreview(false); // Switch from preview to full editor view
    setIsEditing(true);         // Enable editing
  }, []);

  const handleDownload = useCallback(() => {
    setMsg(null);
    const blob = new Blob([fileContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [fileContent, fileName]);

  // This is the crucial fix for "object Object"
  const handleContentChange = useCallback((value) => {
    setFileContent(value);
  }, []);

  const hasUnsavedChanges = fileContent !== originalContent;

  const handleOpenTableEditor = useCallback(() => {
    setTableEditorOpen(true);
  }, []);

  const handleOpenYamlEditor = useCallback(() => {
    setYamlEditorOpen(true);
  }, []);

  return (
    <FileEditorContainer>
      <Header>
        <Title>{fileName}</Title>
        <HeaderActions>
          <IconButton icon={<Download />} onClick={handleDownload} appearance="subtle" title="Download File" />
          <IconButton
            icon={<Trash2 />}
            onClick={() => setShowDeleteConfirmation(true)} // Open confirmation drawer
            appearance="subtle"
            color="red" // Make the trashcan icon red
            title="Delete File"
            disabled={!filePath || isCommonFile || loadingContent || isEditing}
          />
          <IconButton icon={<X />} onClick={onClose} appearance="subtle" title="Close" />
        </HeaderActions>
      </Header>

      <ContentArea>
        {msg}
        {loadingContent ? (
          <Overlay>Loading file content...</Overlay>
        ) : (
          isViewingPreview ? (
            <PreviewContainer>
              {fileContent}
              <FadeOverlay />
            </PreviewContainer>
          ) : (
            <>
              {!isEditing && <Overlay>Click Edit to modify</Overlay>}
              <Input
                style={{fontFamily: 'Consolas, monospace',
                  fontSize: 'smaller',
                  resize: 'auto',
                  height: '100%'
                }}
                value={fileContent}
                as="textarea"
                rows={20}
                onChange={handleContentChange} // Use the new handler here
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
              <Pencil style={{ marginRight: 5 }} /> Edit as text
            </Button>
          ) : (
            <>
              {isEditing ? (
                <>
                  <Button appearance="primary" onClick={handleSave} disabled={!filePath || !hasUnsavedChanges || loadingContent}>
                    <Save style={{ marginRight: 5 }} /> Save
                  </Button>
                  <Button appearance="subtle" onClick={handleCancelEdit} disabled={loadingContent}>
                    <X style={{ marginRight: 5 }} /> Cancel
                  </Button>
                </>
              ) : (
                <Button appearance="primary" onClick={() => setIsEditing(true)} disabled={loadingContent}>
                  <Edit style={{ marginRight: 5 }} /> Edit
                </Button>
              )}
            </>
          )}
        </ButtonToolbar>

        <ButtonToolbar>
          {!isViewingPreview && ( // Only show these in editor mode, not preview
            <>
              {filePath && filePath.endsWith(".csv") && (
                <Button appearance="subtle" onClick={handleOpenTableEditor} disabled={isEditing}>
                  <ScrollText style={{ marginRight: 5 }} /> Open table editor
                </Button>
              )}
              {filePath && (filePath.endsWith(".yaml") || filePath.endsWith(".yml")) && (
                <Button appearance="subtle" onClick={handleOpenYamlEditor} disabled={isEditing}>
                  <Code style={{ marginRight: 5 }} /> Open YAML editor (broken now)
                </Button>
              )}
            </>
          )}
        </ButtonToolbar>
      </Footer>

      {/* Delete Confirmation Drawer */}
      <Drawer
        backdrop={true}
        placement="bottom"
        open={showDeleteConfirmation}
        onClose={() => setShowDeleteConfirmation(false)}
        size="xs" // Smaller drawer
      >
        <Drawer.Header>
          <Drawer.Title><AlertTriangle color="orange" style={{ marginRight: 10 }} /> Confirm Deletion</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body>
          <p>Are you sure you want to delete the file <strong>&quot;{fileName}&quot;</strong>?</p>
          <p>This action cannot be undone.</p>
          <Button onClick={handleDelete} appearance="primary" color="red">
            <Trash2 style={{ marginRight: 5 }} /> Delete Permanently
          </Button>
          <Button onClick={() => setShowDeleteConfirmation(false)} appearance="subtle">
            Cancel
          </Button>
        </Drawer.Body>
      </Drawer>

      {/* Commented out external editors - uncomment and import if available */}
      {/*
      <TableEditorChatGPT
        open={tableEditorOpen}
        onClose={() => setTableEditorOpen(false)}
        onSave={setFileContent}
        fileName={fileName}
        csvData={fileContent}
      />
      <DrawerYamlEditor
        yamlString={fileContent}
        onClose={(value) => { setYamlEditorOpen(false); if (value) setFileContent(value); }}
        open={yamlEditorOpen}
      />
      */}
    </FileEditorContainer>
  );
};

export default FileEditor;