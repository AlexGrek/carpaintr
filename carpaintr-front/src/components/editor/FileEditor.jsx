import React, { useState, useEffect } from 'react';
import { Container, Sidebar, Sidenav, Nav, Content, Button, Modal, Notification, toaster, Input } from 'rsuite';
import { Tree, Tabs } from 'rsuite';
// import { Controlled as CodeMirror } from 'react-codemirror2';
import yaml from 'js-yaml';
import { authFetch } from '../../utils/authFetch';
// import 'codemirror/lib/codemirror.css';
// import 'codemirror/mode/javascript/javascript';
// import 'codemirror/mode/yaml/yaml';

const DirectoryTree = ({ onFileSelect, isCommon }) => {
  const [data, setData] = useState([]);

  useEffect(() => {
    authFetch(isCommon ? '/api/v1/editor/list_common_files' : '/api/v1/editor/list_user_files')
      .then(res => res.json())
      .then(raw => setData(treeFromDirectoryStructure('', raw.Directory.children)));
  }, []);

  const treeFromDirectoryStructure = (path, data) => {
    // console.log(path, data)
    if (data == null) {
        return []
    }
    let processedList = data.map((item) => {
        let processed = null;
        if (item.Directory !== undefined) {
        processed = {
            label: item.Directory.name,
            value: item.Directory.name,
            isFile: false,
            children: treeFromDirectoryStructure(path + item.Directory.name + '/', item.Directory.children)
        }
        }
        else
            processed = {
            label: item.File.name,
            value: path + item.File.name,
            children: null,
            isFile: true
        }
        console.warn(processed)
        return processed
    })
    console.log(JSON.stringify(processedList))
    return processedList
  }

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

const FileEditor = () => {
  const [filePath, setFilePath] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingPath, setPendingPath] = useState(null);
  const [commonUnsaved, setCommonUnsaved] = useState(false);
  const [pendingCommon, setPendingCommon] = useState(false);

  const loadFile = (path, isCommon) => {
    const apiEndpoint = isCommon ? "editor/read_common_file" : "editor/read_user_file"
    authFetch(`/api/v1/${apiEndpoint}/${encodeURIComponent(path)}`)
      .then(res => res.text())
      .then(data => {
        setFilePath(path);
        setFileContent(data);
        setOriginalContent(data);
        setCommonUnsaved(isCommon);
      });
  };

  const validateContent = () => {
    if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
      try { yaml.load(fileContent); return true; } catch { return false; }
    }
    if (filePath.endsWith('.json')) {
      try { JSON.parse(fileContent); return true; } catch { return false; }
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateContent()) {
      toaster.push(<Notification type="error">Invalid file format</Notification>);
      return;
    }
    const formData = new FormData();
    formData.append('file', new Blob([fileContent]), filePath);
    let response = await authFetch(`/api/v1/editor/upload_user_file/${encodeURIComponent(filePath)}`, {
      method: 'POST',
      body: formData
    });
    if (!response.ok) {
      toaster.push(<Notification type="error">File not saved: {JSON.stringify(response.json())}</Notification>);
    } else {
      setOriginalContent(fileContent);
      toaster.push(<Notification type="success">File saved</Notification>);
      setCommonUnsaved(false);
    }
  };

  const handleDelete = async () => {
    let response = await authFetch(`/api/v1/editor/delete_user_file/${encodeURIComponent(filePath)}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      toaster.push(<Notification type="error">File not deleted: {JSON.stringify(response.json())}</Notification>);
    } else {
      setOriginalContent(fileContent);
      toaster.push(<Notification type="success">File deleted</Notification>);
      setCommonUnsaved(false);
    }
  };

  const handleFileChange = (path, isCommon) => {
    if (fileContent !== originalContent) {
      setPendingPath(path);
      setPendingCommon(isCommon);
      setShowConfirm(true);
    } else {
      loadFile(path, isCommon);
    }
  };

  const confirmSwitch = () => {
    setShowConfirm(false);
    if (pendingPath) {
      loadFile(pendingPath, pendingCommon);
      setPendingPath(null);
    }
  };

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
        <Content style={{ padding: 20 }}>
          <Input
            value={fileContent}
            as="textarea"
            rows={10}
            style={{fontFamily: "Consolas, monospace"}}
            // options={{
            //   mode: filePath?.endsWith('.yaml') ? 'yaml' : 'javascript',
            //   lineNumbers: true
            // }}
            onChange={(value) => {
              setFileContent(value);
            }}
          />
          <Button appearance="primary" disabled={(fileContent === originalContent) && !commonUnsaved} onClick={handleSave} style={{ marginTop: 10 }}>
            Save
          </Button>
          <Button appearance="Subtle" disabled={(fileContent !== originalContent) && !commonUnsaved} onClick={handleDelete} style={{ marginTop: 10 }}>
            Delete
          </Button>
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
