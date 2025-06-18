import { useState, useEffect, useCallback } from 'react';
import { Container, Sidebar, Sidenav, Panel, Button, Modal, Notification, toaster, Input, Row, Col, TreePicker } from 'rsuite';
import { Tree, Tabs } from 'rsuite';
import yaml from 'js-yaml';
import { authFetch } from '../../utils/authFetch';
import TableEditorChatGPT from './TableEditorChatGPT';
import { useMediaQuery } from 'react-responsive';
import DrawerYamlEditor from './DrawerYamlEditor';
import DirectoryViewTable from './DirectoryViewTable';

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

const DirectoryTree = ({ onFileSelect, onDirectorySelect, isCommon, listCommonEndpoint, listUserEndpoint }) => {
  const [data, setData] = useState([]);

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const endpoint = isCommon ? `/api/v1/${listCommonEndpoint}` : `/api/v1/${listUserEndpoint}`;
        const res = await authFetch(endpoint);
        const raw = await res.json();
        setData(treeFromDirectoryStructure('', raw.Directory.children));
      } catch (error) {
        toaster.push(<Notification type="error">Failed to load files: {error.message}</Notification>);
      }
    };

    fetchFiles();
  }, [isCommon, listUserEndpoint, listCommonEndpoint]);

  return (
    <TreePicker
      data={data}
      searchable
      onSelect={(node) => {
        if (node.isFile)
          onFileSelect(node.value, isCommon);
        else {
          onDirectorySelect(node.value, node.children, isCommon);
        }
      }}
    />
  );
};

const FileContentEditor = ({ uploadEndpoint, filePath, initialContent, isCommonFile, onSaveSuccess, onDeleteSuccess, deleteEndpoint }) => {
  const [fileContent, setFileContent] = useState(initialContent);
  const [originalContent, setOriginalContent] = useState(initialContent);
  const [tableEditorOpen, setTableEditorOpen] = useState(false);
  const [yamlEditorOpen, setYamlEditorOpen] = useState(false);

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
        if (onSaveSuccess) onSaveSuccess();
      }
    } catch (error) {
      toaster.push(<Notification type="error" header="Network Error">Failed to save file: {error.message}</Notification>, { placement: 'topEnd' });
    }
  }, [fileContent, filePath, validateContent, isCommonFile, onSaveSuccess]);

  const handleOpenTableEditor = useCallback(() => {
    setTableEditorOpen(true);
  })

  const handleOpenYamlEditor = useCallback(() => {
    setYamlEditorOpen(true);
  })


  const handleDelete = useCallback(async () => {
    if (isCommonFile) {
      toaster.push(<Notification type="warning" header="Permission Denied">Cannot delete common files.</Notification>, { placement: 'topEnd' });
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
        style={{ fontFamily: "Consolas, monospace", fontSize: "smaller", flexGrow: 1 }} // Allow textarea to grow
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
          {filePath && filePath.endsWith(".yaml") && <Button appearance='subtle' onClick={handleOpenYamlEditor}>💡 Open yaml editor (broken now)</Button>}
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
          <DrawerYamlEditor yamlString={fileContent} onClose={(value) => { setYamlEditorOpen(false); setFileContent(value) }} open={yamlEditorOpen} />
        </Col>
      </Row>
    </>
  );
};

const FileEditor = ({ readCommonEndpoint, readUserEndpoint, uploadEndpoint, userCommonSwitch, listUserEndpoint, listCommonEndpoint, deleteEndpoint }) => {
  const [filePath, setFilePath] = useState(null);
  const [showDirectory, setShowDirectory] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingPath, setPendingPath] = useState(null);
  const [pendingCommon, setPendingCommon] = useState(false);
  const [isCommonFileSelected, setIsCommonFileSelected] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(false);

  const isMobile = useMediaQuery({ maxWidth: 768 });

  const toggleSidebar = () => setSidebarVisible(!sidebarVisible);

  const loadFile = useCallback(async (path, isCommon) => {
    setShowDirectory(null);
    const apiEndpoint = isCommon ? readCommonEndpoint : readUserEndpoint;
    try {
      const res = await authFetch(`/api/v1/${apiEndpoint}/${encodeURIComponent(path)}`);
      const data = await res.text();
      setFilePath(path);
      setFileContent(data);
      setOriginalContent(data);
      setIsCommonFileSelected(isCommon);
      if (isMobile) setSidebarVisible(false);
    } catch (error) {
      toaster.push(<Notification type="error" header="Load Error">Failed to load file: {error.message}</Notification>, { placement: 'topEnd' });
    }
  }, [isMobile, setShowDirectory, readCommonEndpoint, readUserEndpoint]);

  const handleFileChange = useCallback((path, isCommon) => {
    if (fileContent !== originalContent) {
      setPendingPath(path);
      setPendingCommon(isCommon);
      setShowConfirm(true);
    } else {
      loadFile(path, isCommon);
    }
  }, [fileContent, originalContent, loadFile]);

  const handleDirectoryView = useCallback((path, children, isCommon) => {
    console.log(children);
    if (fileContent !== originalContent) {
      setPendingPath(path);
      setPendingCommon(isCommon);
      setShowConfirm(true);
      setShowDirectory(children);
    } else {
      setShowDirectory(children);
    }
  }, [fileContent, originalContent, setShowDirectory]);

  const confirmSwitch = useCallback(() => {
    setShowConfirm(false);
    if (pendingPath) {
      loadFile(pendingPath, pendingCommon);
      setPendingPath(null);
      setPendingCommon(false);
    }
  }, [pendingPath, pendingCommon, loadFile]);

  const handleSaveSuccess = useCallback(() => {
    setOriginalContent(fileContent);
  }, [fileContent]);

  const handleDeleteSuccess = useCallback(() => {
    setFilePath(null);
    setFileContent('');
    setOriginalContent('');
    setIsCommonFileSelected(false);
  }, []);

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', flexDirection: 'column' }}>
      {isMobile && (
        <div style={{ position: 'absolute', top: 60, left: 10, zIndex: 1000 }}>
          <Button
            onClick={toggleSidebar}
            appearance="ghost"
            size="lg"
            style={{
              backgroundColor: 'rgba(255,255,255,0.9)',
              borderRadius: 6,
              boxShadow: '0 1px 6px rgba(0,0,0,0.2)',
              padding: '6px 12px'
            }}
          >
            ☰
          </Button>
        </div>
      )}
      <div style={{  }}>
        {/* Sidebar */}
        <div>
              <Tabs defaultActiveKey="1" appearance="pills">
                <Tabs.Tab eventKey="1" title="User files">
                  <DirectoryTree onFileSelect={handleFileChange} onDirectorySelect={handleDirectoryView} isCommon={false} listUserEndpoint={listUserEndpoint} />
                </Tabs.Tab>
                {userCommonSwitch && <Tabs.Tab eventKey="2" title="Common files">
                  <DirectoryTree onFileSelect={handleFileChange} onDirectorySelect={handleDirectoryView} isCommon={true} listCommonEndpoint={listCommonEndpoint} />
                </Tabs.Tab>}
              </Tabs>
        </div>

        {/* Overlay */}
        {isMobile && sidebarVisible && (
          <div
            onClick={toggleSidebar}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              backgroundColor: 'rgba(0,0,0,0.3)',
              zIndex: 998,
            }}
          />
        )}

        {/* Editor Content */}
        {showDirectory && <DirectoryViewTable onDirectoryClick={(value) => handleDirectoryView(value.value, value.children, isCommonFileSelected)} onFileClick={(value) => handleFileChange(value, isCommonFileSelected)} value={showDirectory} />}
        <div style={{ flexGrow: 1, padding: isMobile ? 20 : 10, overflowY: 'auto' }}>
          {!showDirectory && filePath ? (
            <FileContentEditor
              uploadEndpoint={uploadEndpoint}
              filePath={filePath}
              initialContent={fileContent}
              isCommonFile={isCommonFileSelected}
              onSaveSuccess={handleSaveSuccess}
              onDeleteSuccess={handleDeleteSuccess}
              deleteEndpoint={deleteEndpoint}
            />
          ) : (null
          )}
        </div>
      </div>

      <Modal open={showConfirm} onClose={() => setShowConfirm(false)}>
        <Modal.Header><Modal.Title>Unsaved Changes</Modal.Title></Modal.Header>
        <Modal.Body>You have unsaved changes. Do you want to discard them and switch files?</Modal.Body>
        <Modal.Footer>
          <Button onClick={confirmSwitch} appearance="primary">Discard and Switch</Button>
          <Button onClick={() => setShowConfirm(false)} appearance="subtle">Cancel</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default FileEditor;