// FilesystemBrowser.jsx - Updated
import React, { useState, useEffect, useCallback } from 'react';
import { Table, SelectPicker, Button, Input, IconButton, Breadcrumb } from 'rsuite';
import {
  File as FileIcon,
  Folder as FolderIcon,
  FileJson,
  FileText,
  FileSignature,
  FileSpreadsheet,
  ScrollText,
  RefreshCw,
  Plus,
  ChevronRight,
  ChevronLeft,
  X
} from 'lucide-react';
import styled, { keyframes, css } from 'styled-components';
import { authFetch } from '../../utils/authFetch';
import DirectoryViewTable from './DirectoryViewTable'
import FileEditor from './FileEditor'; // Renamed and imported FileEditor

// Animation keyframes with fade and ease-out
const slideInRight = keyframes`
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
`;

const slideOutLeft = keyframes`
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(-100%);
    opacity: 0;
  }
`;

const slideInLeft = keyframes`
  from {
    transform: translateX(-100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
`;

const slideOutRight = keyframes`
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(100%);
    opacity: 0;
  }
`;


const AnimationContainer = styled.div`
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  animation-duration: 0.3s;
  animation-fill-mode: forwards;
  animation-timing-function: ease-out;
  ${props => props.$animateIn && props.$direction === 'right' && css`animation-name: ${slideInRight};`}
  ${props => !props.$animateIn && props.$direction === 'left' && css`animation-name: ${slideOutLeft};`}
  ${props => props.$animateIn && props.$direction === 'left' && css`animation-name: ${slideInLeft};`}
  ${props => !props.$animateIn && props.$direction === 'right' && css`animation-name: ${slideOutRight};`}
  z-index: ${props => props.$isNew ? 1 : 0};
  display: flex;
  flex-direction: column;
`;

const FilesystemBrowser = ({
  commonFilesEndpoint,
  userFilesEndpoint,
  deleteEndpoint, // New prop
  readCommonEndpoint, // New prop
  readUserEndpoint, // New prop
  uploadEndpoint // New prop
}) => {
  const [selectedFs, setSelectedFs] = useState('common');
  const [currentPath, setCurrentPath] = useState([]);
  const [directoryData, setDirectoryData] = useState(null);
  const [displayedData, setDisplayedData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [viewingFile, setViewingFile] = useState(null); // Stores file name, e.g., 'my_file.txt'

  const [animationDirection, setAnimationDirection] = useState('none');
  const [prevDisplayedData, setPrevDisplayedData] = useState(null);
  const [isAnimating, setIsAnimating] = useState(false);


  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = selectedFs === 'common' ? commonFilesEndpoint : userFilesEndpoint;
      const response = await authFetch(`/api/v1/${endpoint}`);
      const parsedData = await response.json();
      setDirectoryData(parsedData);
      setCurrentPath([]);
      setLoading(false);
    } catch (err) {
      setError('Failed to fetch data. Please check the network and endpoints.');
      setLoading(false);
      console.error(err);
    }
  }, [selectedFs, commonFilesEndpoint, userFilesEndpoint]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (directoryData) {
      let currentNavData = directoryData.Directory;
      let found = true;

      for (const part of currentPath) {
        const nextDir = currentNavData.children?.find((c) => 'Directory' in c && c.Directory.name === part);
        if (nextDir) {
          currentNavData = nextDir.Directory;
        } else {
          found = false;
          break;
        }
      }

      if (found && currentNavData?.children) {
        const childrenForDisplay = currentNavData.children.map((child) => {
          const isFile = 'File' in child;
          const name = isFile ? child.File.name : child.Directory.name;
          const value = isFile ? child.File.name : undefined;

          return {
            name: name,
            label: name,
            isFile: isFile,
            value: value,
          };
        });
        setDisplayedData(childrenForDisplay);
      } else {
        setDisplayedData([]);
      }
    }
  }, [directoryData, currentPath]);


  const handleDirectoryClick = (rowData) => {
    if (isAnimating) return;

    setPrevDisplayedData(displayedData);
    setAnimationDirection('right');
    setIsAnimating(true);
    setCurrentPath(prev => [...prev, rowData.name]);

    setTimeout(() => {
      setIsAnimating(false);
      setAnimationDirection('none');
      setPrevDisplayedData(null);
    }, 300);
  };

  const handleFileClick = (fileName) => {
    if (isAnimating) return;

    setPrevDisplayedData(displayedData);
    setAnimationDirection('right');
    setIsAnimating(true);
    setViewingFile(fileName);

    setTimeout(() => {
      setIsAnimating(false);
      setAnimationDirection('none');
      setPrevDisplayedData(null);
    }, 300);
  };

  const handleFileEditorClose = () => { // Renamed from handleFilePreviewClose
    if (isAnimating) return;

    setAnimationDirection('left');
    setIsAnimating(true);
    setViewingFile(null);

    setTimeout(() => {
      setIsAnimating(false);
      setAnimationDirection('none');
    }, 300);
  };

  const handleBackOrCloseClick = () => {
    if (isAnimating) return;

    if (viewingFile) {
      handleFileEditorClose();
    } else if (currentPath.length > 0) {
      setPrevDisplayedData(displayedData);
      setAnimationDirection('left');
      setIsAnimating(true);
      setCurrentPath(prev => prev.slice(0, prev.length - 1));

      setTimeout(() => {
        setIsAnimating(false);
        setAnimationDirection('none');
      }, 300);
    }
  };

  const displayPath = directoryData ? `/${directoryData.Directory.name}/${currentPath.join('/')}`.replace(/\/\/+/g, '/') : '/';
  const formattedDisplayPath = displayPath.endsWith('/') && displayPath.length > 1 ? displayPath.slice(0, -1) : displayPath;

  const fullFilePath = currentPath.length > 0 ? `${currentPath.join('/')}/${viewingFile}` : viewingFile;
  const isCommonFile = selectedFs === 'common';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', padding: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'nowrap' }}>
        <SelectPicker
          data={[{ label: 'Common', value: 'common' }, { label: 'User', value: 'user' }]}
          value={selectedFs}
          onChange={(value) => {
            setSelectedFs(value);
            setCurrentPath([]);
          }}
          style={{ width: 120, minWidth: 100, flexShrink: 0 }}
          cleanable={false}
        />

        <IconButton
          icon={viewingFile ? <X /> : <ChevronLeft />}
          onClick={handleBackOrCloseClick}
          appearance="subtle"
          disabled={!viewingFile && currentPath.length === 0}
          style={{ flexShrink: 0 }}
        >
          {viewingFile ? 'Close' : 'Back'}
        </IconButton>

        <Input
          value={formattedDisplayPath}
          readOnly
          style={{ flexGrow: 1, minWidth: 150, flexShrink: 1 }}
        />
        <IconButton icon={<RefreshCw />} onClick={fetchData} appearance="subtle" style={{ flexShrink: 0 }} />
        <IconButton icon={<Plus />} onClick={() => alert('Create functionality coming soon!')} appearance="primary" style={{ flexShrink: 0 }} />
      </div>

      {loading && <p>Loading...</p>}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}

      <div style={{ position: 'relative', flexGrow: 1, overflow: 'hidden' }}>
        {prevDisplayedData && isAnimating && !viewingFile && (
          <AnimationContainer $animateIn={false} $direction={animationDirection === 'right' ? 'left' : 'right'} $isNew={false}>
            <DirectoryViewTable
              value={prevDisplayedData}
              onFileClick={() => {}}
              onDirectoryClick={() => {}}
            />
          </AnimationContainer>
        )}

        {!viewingFile && directoryData && (
          <AnimationContainer $animateIn={isAnimating} $direction={animationDirection} $isNew={true}>
            <DirectoryViewTable
              value={displayedData}
              onFileClick={handleFileClick}
              onDirectoryClick={handleDirectoryClick}
            />
          </AnimationContainer>
        )}

        {viewingFile !== null && (
          <AnimationContainer $animateIn={viewingFile !== null && isAnimating} $direction={animationDirection} $isNew={true}>
            {viewingFile && (
              <FileEditor
                fileName={viewingFile}
                filePath={fullFilePath} // Pass the full path relative to FS root
                isCommonFile={isCommonFile}
                onClose={handleFileEditorClose}
                onSaveSuccess={fetchData} // Refresh directory data on save
                onDeleteSuccess={fetchData} // Refresh directory data on delete
                deleteEndpoint={deleteEndpoint}
                readCommonEndpoint={readCommonEndpoint}
                readUserEndpoint={readUserEndpoint}
                uploadEndpoint={uploadEndpoint}
              />
            )}
          </AnimationContainer>
        )}
      </div>
    </div>
  );
};

export default FilesystemBrowser;