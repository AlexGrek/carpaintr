import React, { useState, useEffect, useCallback } from 'react';
import { Container, Sidebar, Sidenav, Content, Button, Modal, Notification, toaster, Input, Row, Col } from 'rsuite';
import { Tree, Tabs } from 'rsuite';
import yaml from 'js-yaml';
import { authFetch } from '../../utils/authFetch';
import CsvEditorDrawer from './CsvEditorDrawer';
import TableEditorClaude from './TableEditorClaude';
import TableEditorChatGPT from './TableEditorChatGPT';

const treeFromDirectoryStructure = (path, data) => {
  if (data === null) {
    return [];
  }
  return data.map((item) => {
    let processed = null;
    if (item.Directory !== undefined) {
      processed = {
        label: item.Directory.name,
        value: item.Directory.name,
        isFile: false,
        children: treeFromDirectoryStructure(path + item.Directory.name + '/', item.Directory.children)
      };
    } else {
      processed = {
        label: item.File.name,
        value: path + item.File.name,
        children: null,
        isFile: true
      };
    }
    return processed;
  });
};

const DirectoryTree = ({ onFileSelect, isCommon }) => {
  const [data, setData] = useState([]);

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const endpoint = isCommon ? '/api/v1/editor/list_common_files' : '/api/v1/editor/list_user_files';
        const res = await authFetch(endpoint);
        const raw = await res.json();
        setData(treeFromDirectoryStructure('', raw.Directory.children));
      } catch (error) {
        toaster.push(<Notification type="error">Failed to load files: {error.message}</Notification>);
      }
    };

    fetchFiles();
  }, [isCommon]);

  return (
    <Tree
      data={data}
      searchable
      onSelect={(node) => {
        if (node.isFile) onFileSelect(node.value, isCommon);
      }}
    />
  );
};

const FileContentEditor = ({ filePath, initialContent, isCommonFile, onSaveSuccess, onDeleteSuccess }) => {
  const [fileContent, setFileContent] = useState(initialContent);
  const [originalContent, setOriginalContent] = useState(initialContent);
  const [tableEditorOpen, setTableEditorOpen] = useState(false);

  useEffect(() => {
    setFileContent(initialContent);
    setOriginalContent(initialContent);
  }, [initialContent, filePath]);

  const validateContent = useCallback(() => {
    if (!filePath) return true; // No file selected, validation not applicable
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
    formData.append('file', new Blob([fileContent]), filePath);
    try {
      const response = await authFetch(`/api/v1/editor/upload_user_file/${encodeURIComponent(filePath)}`, {
        method: 'POST',
        body: formData
      });
      if (!response.ok) {
        const errorData = await response.json();
        toaster.push(<Notification type="error" header="Save Error">File not saved: {errorData.message || JSON.stringify(errorData)}</Notification>, { placement: 'topEnd' });
      } else {
        setOriginalContent(fileContent);
        toaster.push(<Notification type="success" header="Success">File saved</Notification>, { placement: 'topEnd' });
        if (onSaveSuccess) onSaveSuccess();
      }
    } catch (error) {
      toaster.push(<Notification type="error" header="Network Error">Failed to save file: {error.message}</Notification>, { placement: 'topEnd' });
    }
  }, [fileContent, filePath, validateContent, isCommonFile, onSaveSuccess]);

  const handleOpenTableEditor = useCallback(() => {
    setTableEditorOpen(true);
  })

  const handleDelete = useCallback(async () => {
    if (isCommonFile) {
      toaster.push(<Notification type="warning" header="Permission Denied">Cannot delete common files.</Notification>, { placement: 'topEnd' });
      return;
    }
    try {
      const response = await authFetch(`/api/v1/editor/delete_user_file/${encodeURIComponent(filePath)}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorData = await response.json();
        toaster.push(<Notification type="error" header="Delete Error">File not deleted: {errorData.message || JSON.stringify(errorData)}</Notification>, { placement: 'topEnd' });
      } else {
        toaster.push(<Notification type="success" header="Success">File deleted</Notification>, { placement: 'topEnd' });
        if (onDeleteSuccess) onDeleteSuccess();
      }
    } catch (error) {
      toaster.push(<Notification type="error" header="Network Error">Failed to delete file: {error.message}</Notification>, { placement: 'topEnd' });
    }
  }, [filePath, isCommonFile, onDeleteSuccess]);

  const hasUnsavedChanges = fileContent !== originalContent;

  return (
    <>
      <Input
        value={fileContent}
        as="textarea"
        rows={20}
        style={{ fontFamily: "Consolas, monospace", flexGrow: 1 }} // Allow textarea to grow
        onChange={setFileContent}
        disabled={!filePath} // Disable if no file is selected
      />
      <Row style={{ marginTop: 10 }}>
        <Col>
          <Button
            appearance="primary"
            onClick={handleSave}
            disabled={!(filePath && (hasUnsavedChanges || isCommonFile))}
            style={{ marginRight: 10 }}
          >
            Save
          </Button>
          <Button
            appearance="subtle"
            onClick={handleDelete}
            disabled={!filePath || isCommonFile}
          >
            Delete
          </Button>

          {filePath && filePath.endsWith(".csv") && <Button appearance='subtle' onClick={handleOpenTableEditor}>💡 Open table editor</Button>}
          {/* <CsvEditorDrawer
                show={tableEditorOpen}
                onClose={() => setTableEditorOpen(false)}
                csvString={fileContent}
                fileName={filePath}
                onSave={setFileContent}
            /> */}
          {/* <TableEditorClaude
            isOpen={tableEditorOpen}
            onClose={() => setTableEditorOpen(false)}
            csvData={fileContent}
            fileName={filePath}
            onSave={setFileContent}
          /> */}
          <TableEditorChatGPT
            open={tableEditorOpen}
            onClose={() => setTableEditorOpen(false)}
            onSave={setFileContent}
            fileName={filePath}
            csvData={fileContent}
          />
        </Col>
      </Row>
    </>
  );
};


const FileEditor = () => {
  const [filePath, setFilePath] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingPath, setPendingPath] = useState(null);
  const [pendingCommon, setPendingCommon] = useState(false);
  const [isCommonFileSelected, setIsCommonFileSelected] = useState(false);

  const loadFile = useCallback(async (path, isCommon) => {
    const apiEndpoint = isCommon ? "editor/read_common_file" : "editor/read_user_file";
    try {
      const res = await authFetch(`/api/v1/${apiEndpoint}/${encodeURIComponent(path)}`);
      const data = await res.text();
      setFilePath(path);
      setFileContent(data);
      setOriginalContent(data);
      setIsCommonFileSelected(isCommon);
    } catch (error) {
      toaster.push(<Notification type="error" header="Load Error">Failed to load file: {error.message}</Notification>, { placement: 'topEnd' });
    }
  }, []);

  const handleFileChange = useCallback((path, isCommon) => {
    if (fileContent !== originalContent) {
      setPendingPath(path);
      setPendingCommon(isCommon);
      setShowConfirm(true);
    } else {
      loadFile(path, isCommon);
    }
  }, [fileContent, originalContent, loadFile]);

  const confirmSwitch = useCallback(() => {
    setShowConfirm(false);
    if (pendingPath) {
      loadFile(pendingPath, pendingCommon);
      setPendingPath(null);
      setPendingCommon(false);
    }
  }, [pendingPath, pendingCommon, loadFile]);

  const handleSaveSuccess = useCallback(() => {
    // Refresh the original content after a successful save
    setOriginalContent(fileContent);
  }, [fileContent]);

  const handleDeleteSuccess = useCallback(() => {
    setFilePath(null);
    setFileContent('');
    setOriginalContent('');
    setIsCommonFileSelected(false);
    // Optionally, refresh the directory tree to reflect the deletion
  }, []);

  return (
    <Container>
      <Sidebar
        style={{ display: 'flex', flexDirection: 'column', width: 250 }}
        collapsible
      >
        <Sidenav defaultOpenKeys={[]}>
          <Sidenav.Body>
            <Tabs defaultActiveKey="1" appearance="subtle">
              <Tabs.Tab eventKey="1" title="User files">
                <DirectoryTree onFileSelect={handleFileChange} isCommon={false} />
              </Tabs.Tab>
              <Tabs.Tab eventKey="2" title="Common files">
                <DirectoryTree onFileSelect={handleFileChange} isCommon={true} />
              </Tabs.Tab>
            </Tabs>
          </Sidenav.Body>
        </Sidenav>
      </Sidebar>
      <Container>
        <Content style={{ padding: 10, display: 'flex', flexDirection: 'column' }}>
          {filePath ? (
            <FileContentEditor
              filePath={filePath}
              initialContent={fileContent}
              isCommonFile={isCommonFileSelected}
              onSaveSuccess={handleSaveSuccess}
              onDeleteSuccess={handleDeleteSuccess}
            />
          ) : (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
              Select a file to edit
            </div>
          )}
        </Content>
      </Container>
      <Modal open={showConfirm} onClose={() => setShowConfirm(false)}>
        <Modal.Header><Modal.Title>Unsaved Changes</Modal.Title></Modal.Header>
        <Modal.Body>You have unsaved changes. Do you want to discard them and switch files?</Modal.Body>
        <Modal.Footer>
          <Button onClick={confirmSwitch} appearance="primary">Discard and Switch</Button>
          <Button onClick={() => setShowConfirm(false)} appearance="subtle">Cancel</Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default FileEditor;