// FileEditor.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Button, Input, IconButton, Notification, toaster, ButtonToolbar } from 'rsuite';
import { Edit, Save, X, Trash2, Code, ScrollText } from 'lucide-react'; // Added icons
import styled from 'styled-components';
import { authFetch } from '../../utils/authFetch';
// import * as yaml from 'js-yaml'; // Uncomment if js-yaml is installed
// import TableEditorChatGPT from './TableEditorChatGPT'; // Uncomment if these components exist
// import DrawerYamlEditor from './DrawerYamlEditor'; // Uncomment if these components exist

// Mock yaml for demonstration if not installed
const yaml = {
  load: (content) => {
    try {
      return JSON.parse(content); // Simple JSON parse for mock
    } catch (e) {
      throw new Error("Invalid YAML/JSON format (mock validation)");
    }
  }
};


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
  flex-grow: 1;
  margin-bottom: 15px;
  position: relative; /* For overlay */
`;

const StyledInput = styled(Input)`
  font-family: "Consolas", monospace;
  font-size: smaller;
  height: 100% !important; /* Ensure it fills ContentArea */
  resize: none; /* Disable manual resize */
  border: ${props => props.disabled ? '1px dashed #e5e5ea' : '1px solid #e5e5ea'};
  background-color: ${props => props.disabled ? '#f9f9f9' : '#fff'};
  padding: 10px;
  &:focus {
    border-color: #337ab7;
  }
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
`;

const FileEditor = ({
  fileName,
  filePath, // Full path including selected FS root and directories
  isCommonFile,
  onClose,
  onSaveSuccess,
  onDeleteSuccess,
  deleteEndpoint,
  readCommonEndpoint,
  readUserEndpoint,
  uploadEndpoint
}) => {
  const [fileContent, setFileContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [loadingContent, setLoadingContent] = useState(true);

  // External editor states
  const [tableEditorOpen, setTableEditorOpen] = useState(false);
  const [yamlEditorOpen, setYamlEditorOpen] = useState(false);

  // Fetch file content when fileName or filePath changes
  useEffect(() => {
    const fetchFileContent = async () => {
      setLoadingContent(true);
      try {
        const endpoint = isCommonFile ? readCommonEndpoint : readUserEndpoint;
        const response = await authFetch(`/api/v1/${endpoint}/${encodeURIComponent(filePath)}`);
        if (!response.ok) {
          throw new Error(`Failed to read file: ${response.statusText}`);
        }
        const content = await response.text();
        setFileContent(content);
        setOriginalContent(content);
      } catch (err) {
        toaster.push(<Notification type="error" header="Error">Failed to load file content: {err.message}</Notification>, { placement: 'topEnd' });
        setFileContent('');
        setOriginalContent('');
      } finally {
        setLoadingContent(false);
        setIsEditing(false); // Reset editing mode on new file load
      }
    };

    if (filePath) {
      fetchFileContent();
    }
  }, [filePath, isCommonFile, readCommonEndpoint, readUserEndpoint]);


  const validateContent = useCallback(() => {
    if (!filePath) return true;
    if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
      try { yaml.load(fileContent); return true; } catch (e) { return false; }
    }
    if (filePath.endsWith('.json')) {
      try { JSON.parse(fileContent); return true; } catch (e) { return false; }
    }
    return true;
  }, [filePath, fileContent]);

  const handleSave = useCallback(async () => {
    if (!validateContent()) {
      toaster.push(<Notification type="error" header="Validation Error">Invalid file format</Notification>, { placement: 'topEnd' });
      return;
    }

    const formData = new FormData();
    formData.append('file', new Blob([fileContent]), fileName); // Use fileName for Blob, filePath for endpoint
    try {
      const response = await authFetch(`/api/v1/${uploadEndpoint}/${encodeURIComponent(filePath)}`, {
        method: 'POST',
        body: formData
      });
      if (!response.ok) {
        const errorData = await response.json();
        toaster.push(<Notification type="error" header="Save Error">File not saved: {errorData.message || JSON.stringify(errorData)}</Notification>, { placement: 'topEnd' });
      } else {
        setOriginalContent(fileContent);
        toaster.push(<Notification type="success" header="Success">File saved</Notification>, { placement: 'topEnd' });
        setIsEditing(false); // Exit edit mode after saving
        if (onSaveSuccess) onSaveSuccess();
      }
    } catch (error) {
      toaster.push(<Notification type="error" header="Network Error">Failed to save file: {error.message}</Notification>, { placement: 'topEnd' });
    }
  }, [fileContent, filePath, fileName, validateContent, uploadEndpoint, onSaveSuccess]);


  const handleDelete = useCallback(async () => {
    if (isCommonFile) {
      toaster.push(<Notification type="warning" header="Permission Denied">Cannot delete common files.</Notification>, { placement: 'topEnd' });
      return;
    }
    if (!window.confirm(`Are you sure you want to delete "${fileName}"?`)) {
      return;
    }
    try {
      const response = await authFetch(`/api/v1/${deleteEndpoint}/${encodeURIComponent(filePath)}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorData = await response.json();
        toaster.push(<Notification type="error" header="Delete Error">File not deleted: {errorData.message || JSON.stringify(errorData)}</Notification>, { placement: 'topEnd' });
      } else {
        toaster.push(<Notification type="success" header="Success">File deleted</Notification>, { placement: 'topEnd' });
        if (onDeleteSuccess) onDeleteSuccess();
        onClose(); // Close the editor after deletion
      }
    } catch (error) {
      toaster.push(<Notification type="error" header="Network Error">Failed to delete file: {error.message}</Notification>, { placement: 'topEnd' });
    }
  }, [filePath, fileName, isCommonFile, onDeleteSuccess, deleteEndpoint, onClose]);

  const handleCancelEdit = useCallback(() => {
    setFileContent(originalContent); // Revert to original content
    setIsEditing(false); // Exit edit mode
  }, [originalContent]);

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
        <Title>File: {fileName}</Title>
        <IconButton icon={<X />} onClick={onClose} appearance="subtle" />
      </Header>

      <ContentArea>
        {loadingContent ? (
          <Overlay>Loading file content...</Overlay>
        ) : (
          <>
            {!isEditing && <Overlay>Click "Edit" to modify</Overlay>}
            <StyledInput
              value={fileContent}
              as="textarea"
              rows={20}
              onChange={setFileContent}
              disabled={!isEditing || !filePath}
            />
          </>
        )}
      </ContentArea>

      <Footer>
        <ButtonToolbar>
          {!isEditing ? (
            <Button appearance="primary" onClick={() => setIsEditing(true)} disabled={loadingContent}>
              <Edit style={{ marginRight: 5 }} /> Edit
            </Button>
          ) : (
            <>
              <Button appearance="primary" onClick={handleSave} disabled={!filePath || !hasUnsavedChanges || loadingContent}>
                <Save style={{ marginRight: 5 }} /> Save
              </Button>
              <Button appearance="subtle" onClick={handleCancelEdit} disabled={loadingContent}>
                <X style={{ marginRight: 5 }} /> Cancel
              </Button>
            </>
          )}
          <Button
            appearance="subtle"
            onClick={handleDelete}
            disabled={!filePath || isCommonFile || loadingContent || isEditing}
          >
            <Trash2 style={{ marginRight: 5 }} /> Delete
          </Button>
        </ButtonToolbar>

        <ButtonToolbar>
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
        </ButtonToolbar>
      </Footer>

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