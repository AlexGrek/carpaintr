// FilesystemBrowser.jsx
import { useState, useEffect, useCallback } from 'react';
import { SelectPicker, Input, IconButton, InputGroup } from 'rsuite';
import {
    RefreshCw,
    Plus,
    ChevronLeft,
    X
} from 'lucide-react';
import styled, { keyframes, css } from 'styled-components';
import { authFetch } from '../../utils/authFetch';
import DirectoryViewTable from './DirectoryViewTable';
import FileEditor from './FileEditor';

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

const FilesystemBrowser = ({ filesystems }) => {
    const [selectedFsName, setSelectedFsName] = useState(filesystems[0]?.name || '');
    const [currentPath, setCurrentPath] = useState([]);
    const [directoryData, setDirectoryData] = useState(null);
    const [displayedData, setDisplayedData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [viewingFile, setViewingFile] = useState(null);

    const [animationDirection, setAnimationDirection] = useState('none');
    const [prevDisplayedData, setPrevDisplayedData] = useState(null);
    const [isAnimating, setIsAnimating] = useState(false);

    // Find the configuration for the currently selected filesystem
    const currentFsConfig = filesystems.find(fs => fs.name === selectedFsName);

    const fetchData = useCallback(async () => {
        if (!currentFsConfig?.listEndpoint) {
            setError('List endpoint not configured for the selected filesystem.');
            setLoading(false);
            setDirectoryData(null);
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const response = await authFetch(`/api/v1/${currentFsConfig.listEndpoint}`);
            const parsedData = await response.json();
            setDirectoryData(parsedData);
            setCurrentPath([]); // Reset path when fetching new data for selected filesystem
            setLoading(false);
        } catch (err) {
            setError('Failed to fetch data. Please check the network and endpoints.');
            setLoading(false);
            console.error(err);
        }
    }, [currentFsConfig]);

    useEffect(() => {
        // Fetch data only if a filesystem is selected
        if (selectedFsName) {
            fetchData();
        }
    }, [fetchData, selectedFsName]);

    useEffect(() => {
        if (directoryData) {
            let currentNavData = directoryData.Directory;
            let found = true;

            // Traverse through the currentPath to find the correct directory level
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
        setCurrentPath(prev => [...prev, rowData.name]); // Data change occurs here

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
        setViewingFile(fileName); // Data change occurs here

        setTimeout(() => {
            setIsAnimating(false);
            setAnimationDirection('none');
            setPrevDisplayedData(null);
        }, 300);
    };

    const handleFileEditorClose = () => {
        if (isAnimating) return;

        setAnimationDirection('left');
        setIsAnimating(true);
        setViewingFile(null); // Data change occurs here

        setTimeout(() => {
            setIsAnimating(false);
            setAnimationDirection('none');
        }, 300);
    };

    const handleBackOrCloseClick = () => {
        if (isAnimating) return;

        if (viewingFile) {
            handleFileEditorClose(); // If a file is being viewed, close it
        } else if (currentPath.length > 0) { // Otherwise, navigate back in directory
            setPrevDisplayedData(displayedData);
            setAnimationDirection('left');
            setIsAnimating(true);
            setCurrentPath(prev => prev.slice(0, prev.length - 1)); // Data change occurs here

            setTimeout(() => {
                setIsAnimating(false);
                setAnimationDirection('none');
            }, 300);
        }
    };

    // Construct the full path for display
    const displayPath = directoryData ? `/${directoryData.Directory.name}/${currentPath.join('/')}`.replace(/\/\/+/g, '/') : '/';
    // Remove trailing slash if it's just the root
    const formattedDisplayPath = displayPath.endsWith('/') && displayPath.length > 1 ? displayPath.slice(0, -1) : displayPath;

    // Construct the full file path for FileEditor
    const fullFilePath = currentPath.length > 0 ? `${currentPath.join('/')}/${viewingFile}` : viewingFile;

    // Determine if the current file is from the 'common' filesystem (assuming 'common' is its name)
    const isCommonFile = selectedFsName === 'common';

    // Prepare options for the SelectPicker
    const filesystemOptions = filesystems.map(fs => ({ label: fs.name, value: fs.name }));

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontSize: 'smaller', padding: 10 }}>
            {/* Hide SelectPicker if only one filesystem is supplied */}
            {filesystems.length > 1 && (
                <SelectPicker
                    data={filesystemOptions}
                    value={selectedFsName}
                    onChange={(value) => {
                        setSelectedFsName(value);
                        setCurrentPath([]); // Reset path on FS change
                        setViewingFile(null); // Close any open file editor on FS change
                    }}
                    style={{ width: 120, minWidth: 100, flexShrink: 0 }}
                    cleanable={false}
                />
            )}
            {/* Top Bar - Single flexible row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'nowrap' }}>



                <InputGroup inside style={{ flexGrow: 1, minWidth: 150, flexShrink: 1 }}>
                    <InputGroup.Button
                        onClick={handleBackOrCloseClick}
                        // Disable if a file is not being viewed AND at the root of the current path
                        disabled={!viewingFile && currentPath.length === 0}
                    >
                        {viewingFile ? <X /> : <ChevronLeft />}
                    </InputGroup.Button>
                    <Input
                        value={formattedDisplayPath}
                        readOnly
                    />
                </InputGroup>
                <IconButton icon={<RefreshCw />} onClick={fetchData} appearance="subtle" style={{ flexShrink: 0 }} />
                <IconButton icon={<Plus />} onClick={() => alert('Create functionality coming soon!')} appearance="primary" style={{ flexShrink: 0 }} />
            </div>

            {loading && <p>Loading...</p>}
            {error && <p style={{ color: 'red' }}>Error: {error}</p>}

            <div style={{ position: 'relative', flexGrow: 1, overflow: 'hidden' }}>
                {/* Previous content animating out */}
                {prevDisplayedData && isAnimating && !viewingFile && (
                    <AnimationContainer $animateIn={false} $direction={animationDirection === 'right' ? 'left' : 'right'} $isNew={false}>
                        <DirectoryViewTable
                            value={prevDisplayedData}
                            onFileClick={() => { }} // No interaction during animation
                            onDirectoryClick={() => { }}
                        />
                    </AnimationContainer>
                )}

                {/* Current content animating in */}
                {!viewingFile && directoryData && (
                    <AnimationContainer $animateIn={isAnimating} $direction={animationDirection} $isNew={true}>
                        <DirectoryViewTable
                            value={displayedData}
                            onFileClick={handleFileClick}
                            onDirectoryClick={handleDirectoryClick}
                        />
                    </AnimationContainer>
                )}

                {/* File Editor animating in/out */}
                {viewingFile !== null && currentFsConfig && ( // Ensure currentFsConfig is available for FileEditor props
                    <AnimationContainer $animateIn={viewingFile !== null && isAnimating} $direction={animationDirection} $isNew={true}>
                        {viewingFile && ( // Only render FileEditor if viewingFile is not null
                            <FileEditor
                                fileName={viewingFile}
                                filePath={fullFilePath} // Pass the full path relative to FS root
                                isCommonFile={isCommonFile}
                                onClose={handleFileEditorClose}
                                onSaveSuccess={fetchData} // Refresh directory data on save
                                onDeleteSuccess={fetchData} // Refresh directory data on delete
                                readEndpoint={currentFsConfig.readEndpoint}
                                uploadEndpoint={currentFsConfig.uploadEndpoint}
                                deleteEndpoint={currentFsConfig.deleteEndpoint}
                            />
                        )}
                    </AnimationContainer>
                )}
            </div>
        </div>
    );
};

export default FilesystemBrowser;