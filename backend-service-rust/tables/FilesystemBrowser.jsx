// FilesystemBrowser.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { SelectPicker, Input, IconButton, InputGroup, Loader, Dropdown, Modal, Button, Message } from 'rsuite';
import {
    RefreshCw,
    Plus,
    ChevronLeft,
    X,
    History,
    FileUp,
    FilePlus,
    Table
} from 'lucide-react';
import styled, { keyframes, css } from 'styled-components';
import { authFetch } from '../../utils/authFetch';
import DirectoryViewTable from './DirectoryViewTable';
import FileEditor from './FileEditor';
import CommitHistoryDrawer from './CommitHistoryDrawer';
import { useLocale, registerTranslations } from '../../localization/LocaleContext';

registerTranslations("ua",
    {
        "Create functionality coming soon!": "На стадії розробки",
        "Upload File": "Завантажити файл",
        "Create Table": "Створити таблицю",
        "Create Data Source": "Створити джерело даних",
        "Create": "Створити",
        "Cancel": "Скасувати",
        "File Name": "Ім'я файлу",
        "Drop files here to upload": "Перетягніть файли сюди для завантаження",
        "File uploaded successfully": "Файл успішно завантажено",
        "Failed to upload file": "Не вдалося завантажити файл",
        "File created successfully": "Файл успішно створено",
        "Failed to create file": "Не вдалося створити файл",
    }
);

const slideInRight = keyframes`
  from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; }
`;
const slideOutLeft = keyframes`
  from { transform: translateX(0); opacity: 1; } to { transform: translateX(-100%); opacity: 0; }
`;
const slideInLeft = keyframes`
  from { transform: translateX(-100%); opacity: 0; } to { transform: translateX(0); opacity: 1; }
`;
const slideOutRight = keyframes`
  from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; }
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

const UploaderContainer = styled.div`
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100%;
    border: 2px dashed #a0a0a0;
    border-radius: 8px;
    background-color: #f9f9f9;
    color: #a0a0a0;
    font-size: 1.2rem;
    transition: background-color 0.2s;
    ${props => props.$isDragActive && css`
        background-color: #e0e0e0;
        border-color: #606060;
    `}
`;

const FilesystemBrowser = ({ filesystems }) => {
    const { str } = useLocale();
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
    const [showCommitsDrawer, setShowCommitsDrawer] = useState(false);

    // New state for upload functionality
    const [isDragging, setIsDragging] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newFileType, setNewFileType] = useState(null); // 'csv' or 'yaml'
    const [newFileName, setNewFileName] = useState('');
    const fileInputRef = useRef(null);

    const currentFsConfig = filesystems.find(fs => fs.name === selectedFsName);

    const fetchData = useCallback(async () => {
        if (!currentFsConfig?.listEndpoint) {
            setError('List endpoint not configured for the selected filesystem.');
            setLoading(false);
            setDirectoryData(null);
            return;
        }
        setViewingFile(null);
        setLoading(true);
        setError(null);
        try {
            const response = await authFetch(`/api/v1/${currentFsConfig.listEndpoint}`);
            const parsedData = await response.json();
            setDirectoryData(parsedData);
            // The logic to reset the current path was causing an infinite loop because
            // `fetchData` depended on `currentPath`, and this block was calling `setCurrentPath`.
            // The path is now correctly reset only when the filesystem selection changes.
            setLoading(false);
        } catch (err) {
            setError('Failed to fetch data. Please check the network and endpoints.');
            setLoading(false);
            console.error(err);
        }
    }, [currentFsConfig]);


    useEffect(() => {
        if (selectedFsName) {
            fetchData();
        }
    }, [fetchData, selectedFsName]);

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
                    return { name, label: name, isFile, value: isFile ? name : undefined };
                });
                setDisplayedData(childrenForDisplay);
            } else {
                setDisplayedData([]);
            }
        }
    }, [directoryData, currentPath]);

    const displayPath = directoryData ? `/${directoryData.Directory.name}/${currentPath.join('/')}`.replace(/\/\/+/g, '/') : '/';
    const formattedDisplayPath = displayPath.length > 1 && displayPath.endsWith('/') ? displayPath.slice(0, -1) : displayPath;
    const fullFilePath = viewingFile ? [...currentPath, viewingFile].join('/') : currentPath.join('/');

    // --- UPLOAD AND FILE CREATION LOGIC ---

    const handleFileUpload = async (files) => {
        if (!currentFsConfig?.uploadEndpoint) {
            setError(str('Upload endpoint not configured.'));
            return;
        }
        setLoading(true);
        const uploadPath = currentPath.join('/');

        for (const file of files) {
            const formData = new FormData();
            formData.append('file', file);
            const filePath = uploadPath ? `${uploadPath}/${file.name}` : file.name;

            try {
                const response = await authFetch(`/api/v1/${currentFsConfig.uploadEndpoint}/${encodeURIComponent(filePath)}`, {
                    method: 'POST',
                    body: formData,
                });
                if (response.ok) {
                    console.log("FIle uploaded.")
                } else {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Unknown upload error');
                }
            } catch (err) {
                setError(str('Failed to upload file') + err.message);
                console.error(err);
            }
        }
        await fetchData(); // Refresh directory view
        setLoading(false);
    };

    const handleCreateFile = async () => {
        if (!newFileName || !newFileType || !currentFsConfig?.uploadEndpoint) return;

        setLoading(true);
        setShowCreateModal(false);

        const extension = `.${newFileType}`;
        const fileNameWithExt = newFileName.endsWith(extension) ? newFileName : `${newFileName}${extension}`;
        const content = newFileType === 'yaml' ? '' : '""\n'; // Empty CSV with header
        const file = new File([content], fileNameWithExt, { type: newFileType === 'csv' ? 'text/csv' : 'application/x-yaml' });
        const uploadPath = currentPath.join('/');
        const filePath = uploadPath ? `${uploadPath}/${fileNameWithExt}` : fileNameWithExt;

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await authFetch(`/api/v1/${currentFsConfig.uploadEndpoint}/${encodeURIComponent(filePath)}`, {
                method: 'POST',
                body: formData
            });
            if (response.ok) {
                console.log("File created.");
                setNewFileName('');
                await fetchData();
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Unknown creation error');
            }
        } catch (err) {
            setError(str('Failed to create file') + err.message);
            console.error(err);
        }
        setLoading(false);
    };

    const handleDragEnter = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };
    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Use a timeout to prevent flickering when moving over child elements
        setTimeout(() => setIsDragging(false), 50);
    };
    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation(); // Necessary to allow drop
    };
    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFileUpload(e.dataTransfer.files);
            e.dataTransfer.clearData();
        }
    };

    // --- END UPLOAD LOGIC ---

    const handleDirectoryClick = (rowData) => {
        if (isAnimating) return;
        setPrevDisplayedData(displayedData);
        setAnimationDirection('right');
        setIsAnimating(true);
        setCurrentPath(prev => [...prev, rowData.name]);
        setTimeout(() => { setIsAnimating(false); setAnimationDirection('none'); setPrevDisplayedData(null); }, 300);
    };

    const handleFileClick = (fileName) => {
        if (isAnimating) return;
        setPrevDisplayedData(displayedData);
        setAnimationDirection('right');
        setIsAnimating(true);
        setViewingFile(fileName);
        setTimeout(() => { setIsAnimating(false); setAnimationDirection('none'); setPrevDisplayedData(null); }, 300);
    };

    const handleFileEditorClose = () => {
        if (isAnimating) return;
        setAnimationDirection('left');
        setIsAnimating(true);
        setViewingFile(null);
        setTimeout(() => { setIsAnimating(false); setAnimationDirection('none'); }, 300);
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
            setTimeout(() => { setIsAnimating(false); setAnimationDirection('none'); }, 300);
        }
    };

    const filesystemOptions = filesystems.map(fs => ({ label: fs.name, value: fs.name }));
    const isCommonFile = selectedFsName === 'common';

    const renderMenu = ({ onClose, left, top, className }, ref) => {
        const handleSelect = (eventKey) => {
            onClose();
            if (eventKey === 'upload') {
                fileInputRef.current?.click();
            } else if (eventKey === 'create-table') {
                setNewFileType('csv');
                setShowCreateModal(true);
            } else if (eventKey === 'create-datasource') {
                setNewFileType('yaml');
                setShowCreateModal(true);
            }
        };
        return (
            <Dropdown.Menu ref={ref} className={className} style={{ left, top }} onSelect={handleSelect}>
                <Dropdown.Item eventKey="upload" icon={<FileUp size={16} />}>{str('Upload File')}</Dropdown.Item>
                <Dropdown.Item eventKey="create-table" icon={<Table size={16} />}>{str('Create Table')}</Dropdown.Item>
                <Dropdown.Item eventKey="create-datasource" icon={<FilePlus size={16} />}>{str('Create Data Source')}</Dropdown.Item>
            </Dropdown.Menu>
        );
    };

    return (
        <div onDragEnter={handleDragEnter}>
            <input
                type="file"
                multiple
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={(e) => handleFileUpload(e.target.files)}
            />
            {currentFsConfig.historyEnabled && <CommitHistoryDrawer show={showCommitsDrawer} onRevert={fetchData} onClose={() => setShowCommitsDrawer(false)} />}

            <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)}>
                <Modal.Header>
                    <Modal.Title>{str(newFileType === 'csv' ? 'Create Table' : 'Create Data Source')}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <InputGroup>
                        <Input
                            placeholder={str("File Name")}
                            value={newFileName}
                            onChange={setNewFileName}
                            onPressEnter={handleCreateFile}
                        />
                        <InputGroup.Addon>.{newFileType}</InputGroup.Addon>
                    </InputGroup>
                </Modal.Body>
                <Modal.Footer>
                    <Button onClick={handleCreateFile} appearance="primary">{str('Create')}</Button>
                    <Button onClick={() => setShowCreateModal(false)} appearance="subtle">{str('Cancel')}</Button>
                </Modal.Footer>
            </Modal>

            <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontSize: 'smaller', padding: 10 }}>
                {filesystems.length > 1 && (
                    <SelectPicker
                        data={filesystemOptions}
                        value={selectedFsName}
                        onChange={(value) => { setSelectedFsName(value); setCurrentPath([]); setViewingFile(null); }}
                        style={{ width: 120, minWidth: 100, flexShrink: 0 }}
                        cleanable={false}
                    />
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'nowrap' }}>
                    <InputGroup inside style={{ flexGrow: 1, minWidth: 150, flexShrink: 1 }}>
                        <InputGroup.Button onClick={handleBackOrCloseClick} disabled={!viewingFile && currentPath.length === 0}>
                            {viewingFile ? <X /> : <ChevronLeft />}
                        </InputGroup.Button>
                        <Input value={formattedDisplayPath} readOnly />
                    </InputGroup>
                    <IconButton icon={<RefreshCw />} onClick={fetchData} appearance="subtle" style={{ flexShrink: 0 }} />
                    <Dropdown renderToggle={(props, ref) => <IconButton {...props} ref={ref} icon={<Plus />} appearance="primary" />} placement="bottomEnd" trigger="click" renderMenu={renderMenu} />
                    {currentFsConfig.historyEnabled && <IconButton icon={<History />} onClick={() => setShowCommitsDrawer(true)} appearance="subtle" style={{ flexShrink: 0 }} />}
                </div>

                {loading && <Loader center />}
                {error && <p style={{ color: 'red' }}>Error: {error}</p>}

                <div
                    style={{ position: 'relative', flexGrow: 1, overflow: 'hidden' }}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                >
                    {isDragging ? (
                        <UploaderContainer $isDragActive={isDragging}>
                            {str('Drop files here to upload')}
                        </UploaderContainer>
                    ) : (
                        <>
                            {prevDisplayedData && isAnimating && !viewingFile && (
                                <AnimationContainer $animateIn={false} $direction={animationDirection === 'right' ? 'left' : 'right'} $isNew={false}>
                                    <DirectoryViewTable value={prevDisplayedData} onFileClick={() => { }} onDirectoryClick={() => { }} />
                                </AnimationContainer>
                            )}

                            {!viewingFile && directoryData && (
                                <AnimationContainer $animateIn={isAnimating} $direction={animationDirection} $isNew={true}>
                                    <DirectoryViewTable value={displayedData} onFileClick={handleFileClick} onDirectoryClick={handleDirectoryClick} />
                                </AnimationContainer>
                            )}

                            {viewingFile !== null && currentFsConfig && (
                                <AnimationContainer $animateIn={viewingFile !== null && isAnimating} $direction={animationDirection} $isNew={true}>
                                    {viewingFile && (
                                        <FileEditor
                                            fileName={viewingFile}
                                            filePath={fullFilePath}
                                            isCommonFile={isCommonFile}
                                            onClose={handleFileEditorClose}
                                            onSaveSuccess={fetchData}
                                            onDeleteSuccess={fetchData}
                                            readEndpoint={currentFsConfig.readEndpoint}
                                            uploadEndpoint={currentFsConfig.uploadEndpoint}
                                            deleteEndpoint={currentFsConfig.deleteEndpoint}
                                        />
                                    )}
                                </AnimationContainer>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default FilesystemBrowser;
