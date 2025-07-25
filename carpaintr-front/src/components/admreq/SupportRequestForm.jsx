import React, { useEffect, useState } from 'react';
import { Input, Button, TagPicker, Message, toaster, Progress } from 'rsuite';
import { authFetch } from '../../utils/authFetch';
import AppVersionBadge from '../AppVersionBadge';
import { registerTranslations, useLocale } from '../../localization/LocaleContext';
import Trans from '../../localization/Trans';
import { FileUpload, Close } from '@rsuite/icons';
import { FileIcon } from 'lucide-react';

// --- Internationalization ---
registerTranslations("ua", {
    "Short summary of the issue": "Узагальнений опис запиту",
    "bug": "Баг",
    "issue": "Проблема",
    "question": "Запитання",
    "error": "Помилка",
    "request": "Запит",
    "proposal": "Пропозиція",
    "Detailed description": "Детальний опис",
    "Choose request type": "Виберіть тип запиту",
    "Submit a Support Request": "Надіслати запит до підтримки",
    "Title": "Тема",
    "Contacts": "Ваші контакти",
    "Submit": "Надіслати",
    "Phone number, viber, telegram, email, etc.": "Телефон, вайбер, електронна пошта...",
    "Support request submitted successfully.": "Запит надіслано",
    "Attachments": "Вкладення",
    "Click or Drag files to this area to upload": "Натисніть або перетягніть файли сюди для завантаження",
    "Upload": "Завантажити",
    "File upload failed.": "Не вдалося завантажити файл.",
    "File size exceeds the 9MB limit.": "Розмір файлу перевищує ліміт у 9МБ.",
    "Invalid file type.": "Неприпустимий тип файлу.",
    "You can upload up to 5 files.": "Ви можете завантажити до 5 файлів.",
    "Submission failed.": "Не вдалося надіслати запит.",
    "Max size:": "Макс. розмір:",
    "Remove": "Видалити",
    "Uploading...": "Завантаження..."
});

// --- Helper Functions and Constants ---

const MAX_FILES = 5;
const MAX_SIZE_MB = 9;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

const ALLOWED_EXTENSIONS = [
    'doc', 'docx', 'jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'xls', 'xlsx',
    'js', 'json', 'yaml', 'yml', 'csv', 'txt', 'md', 'zip', 'rar', '7z', 'jwt',
    'rs', 'ts', 'jsx', 'tsx', 'css', 'html', 'mhtml', 'pdf'
];

const formatBytes = (bytes, decimals = 2) => {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

// --- Custom File Upload Component ---

const CustomFileUploader = ({ attachments, setAttachments, disabled }) => {
    const [uploadingFiles, setUploadingFiles] = useState([]); // Files currently being uploaded
    const [dragActive, setDragActive] = useState(false);
    const { str } = useLocale();

    const validateFile = (file) => {
        const fileExt = file.name.split('.').pop()?.toLowerCase();
        if (!fileExt || !ALLOWED_EXTENSIONS.includes(fileExt)) {
            toaster.push(<Message type="error" closable>{`${str("Invalid file type.")}: ${file.name}`}</Message>);
            return false;
        }

        if (file.size > MAX_SIZE_BYTES) {
            toaster.push(<Message type="error" closable>{`${str("File size exceeds the 9MB limit.")}: ${file.name}`}</Message>);
            return false;
        }

        return true;
    };

    const uploadFile = async (file) => {
        const fileId = Date.now() + Math.random(); // Unique ID for tracking
        const uploadingFile = {
            id: fileId,
            name: file.name,
            size: file.size,
            progress: 0,
            status: 'uploading'
        };

        // Add to uploading files list
        setUploadingFiles(prev => [...prev, uploadingFile]);

        try {
            const formData = new FormData();
            formData.append('file', file);

            // Create custom XMLHttpRequest for progress tracking
            const xhr = new XMLHttpRequest();
            
            // Set up progress tracking
            xhr.upload.addEventListener('progress', (event) => {
                if (event.lengthComputable) {
                    const percentCompleted = Math.round((event.loaded * 100) / event.total);
                    setUploadingFiles(prev =>
                        prev.map(f => f.id === fileId ? { ...f, progress: percentCompleted } : f)
                    );
                }
            });

            // Handle successful upload
            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const response = JSON.parse(xhr.responseText);
                        
                        // Add to attachments
                        const newAttachment = {
                            id: response.id,
                            filename: response.fileName,
                            sizeBytes: response.size,
                        };
                        setAttachments(prev => [...prev, newAttachment]);

                        // Remove from uploading files
                        setUploadingFiles(prev => prev.filter(f => f.id !== fileId));
                        
                        toaster.push(<Message type="success" closable>{`${file.name} ${str('uploaded successfully')}`}</Message>);
                    } catch (e) {
                        console.error("Failed to parse upload response:", e);
                        handleUploadError(fileId, file.name);
                    }
                } else {
                    console.error(`Request failed with status ${xhr.status}: ${xhr.responseText}`);
                    handleUploadError(fileId, file.name);
                }
            });

            // Handle upload error
            xhr.addEventListener('error', () => {
                console.error("XHR upload error");
                handleUploadError(fileId, file.name);
            });

            xhr.open('POST', '/api/v1/user/attach', true);

            // Set auth header
            const token = localStorage.getItem('authToken');
            if (token) {
                xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            }

            xhr.send(formData);

        } catch (error) {
            console.error("Upload error:", error);
            handleUploadError(fileId, file.name);
        }
    };

    const handleUploadError = (fileId, fileName) => {
        toaster.push(<Message type="error" closable>{`${str("File upload failed.")} - ${fileName}`}</Message>);
        setUploadingFiles(prev => prev.filter(f => f.id !== fileId));
    };

    const handleFiles = (files) => {
        const fileArray = Array.from(files);
        
        if (attachments.length + uploadingFiles.length + fileArray.length > MAX_FILES) {
            toaster.push(<Message type="error" closable>{str("You can upload up to 5 files.")}</Message>);
            return;
        }

        fileArray.forEach(file => {
            if (validateFile(file)) {
                uploadFile(file);
            }
        });
    };

    const handleFileSelect = (event) => {
        const files = event.target.files;
        if (files && files.length > 0) {
            handleFiles(files);
        }
        // Reset input value to allow selecting the same file again
        event.target.value = '';
    };

    const handleDrop = (event) => {
        event.preventDefault();
        setDragActive(false);
        
        const files = event.dataTransfer.files;
        if (files && files.length > 0) {
            handleFiles(files);
        }
    };

    const handleDragOver = (event) => {
        event.preventDefault();
        setDragActive(true);
    };

    const handleDragLeave = (event) => {
        event.preventDefault();
        setDragActive(false);
    };

    const removeAttachment = (attachmentId) => {
        setAttachments(prev => prev.filter(att => att.id !== attachmentId));
    };

    return (
        <div>
            {/* Drop Zone */}
            <div
                style={{
                    padding: '20px',
                    border: `2px dashed ${dragActive ? '#3498ff' : '#d9d9d9'}`,
                    borderRadius: '8px',
                    textAlign: 'center',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    color: disabled ? '#ccc' : '#999',
                    transition: 'border-color 0.3s',
                    backgroundColor: dragActive ? '#f0f8ff' : 'transparent'
                }}
                onDrop={!disabled ? handleDrop : undefined}
                onDragOver={!disabled ? handleDragOver : undefined}
                onDragLeave={!disabled ? handleDragLeave : undefined}
                onClick={!disabled ? () => document.getElementById('file-input').click() : undefined}
            >
                <FileUpload style={{ fontSize: '3em', color: disabled ? '#ccc' : '#3498ff' }}/>
                <p style={{marginTop: '8px'}}><Trans>Click or Drag files to this area to upload</Trans></p>
                <small>{str("You can upload up to 5 files.")} {str("Max size:")} {MAX_SIZE_MB}MB</small>
                
                <input
                    id="file-input"
                    type="file"
                    multiple
                    accept={ALLOWED_EXTENSIONS.map(ext => `.${ext}`).join(',')}
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                    disabled={disabled}
                />
            </div>

            {/* Uploading Files */}
            {uploadingFiles.map(file => (
                <div key={file.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '10px',
                    margin: '10px 0',
                    border: '1px solid #e5e5e5',
                    borderRadius: '4px',
                    backgroundColor: '#f9f9f9'
                }}>
                    <FileIcon style={{ marginRight: '10px', color: '#666' }} />
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '14px', fontWeight: '500' }}>
                            {file.name} ({formatBytes(file.size)})
                        </div>
                        <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                            {str("Uploading...")} {file.progress}%
                        </div>
                        <Progress percent={file.progress} strokeColor="#3498ff" style={{ marginTop: '4px' }} />
                    </div>
                </div>
            ))}

            {/* Uploaded Files */}
            {attachments.map(attachment => (
                <div key={attachment.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px',
                    margin: '10px 0',
                    border: '1px solid #e5e5e5',
                    borderRadius: '4px',
                    backgroundColor: '#f0f8f0'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <FileIcon style={{ marginRight: '10px', color: '#52c41a' }} />
                        <div>
                            <div style={{ fontSize: '14px', fontWeight: '500' }}>
                                {attachment.filename}
                            </div>
                            <div style={{ fontSize: '12px', color: '#666' }}>
                                {formatBytes(attachment.sizeBytes)}
                            </div>
                        </div>
                    </div>
                    <Button
                        size="sm"
                        appearance="subtle"
                        color="red"
                        onClick={() => removeAttachment(attachment.id)}
                        disabled={disabled}
                    >
                        <Close />
                    </Button>
                </div>
            ))}
        </div>
    );
};

// --- Main Component ---

const SupportRequestForm = () => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [reqType, setReqType] = useState('');
    const [contacts, setContacts] = useState('');
    const [attachments, setAttachments] = useState([]);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const { str } = useLocale();

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const msg = params.get('msg');
        if (msg) setTitle(decodeURIComponent(msg));
    }, []);

    const handleSubmit = async () => {
        setSubmitting(true);
        const contactMap = {};
        contacts.split(',').forEach(entry => {
            const [k, v] = entry.split('=');
            if (k && v) contactMap[k.trim()] = v.trim();
        });

        const payload = {
            title,
            description,
            reqType,
            contacts: contactMap,
            attachments: attachments.map(att => att.id),
        };

        try {
            const res = await authFetch('/api/v1/user/support_request_submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                toaster.push(<Message type="success" closable>{str('Support request submitted successfully.')}</Message>);
                setSubmitted(true);
                setTitle('');
                setDescription('');
                setReqType('');
                setContacts('');
                setAttachments([]);
            } else {
                const errorData = await res.json().catch(() => ({ message: 'Unknown error' }));
                toaster.push(<Message type="error" closable>{`${str('Submission failed.')} ${errorData.message || ''}`}</Message>);
            }
        } catch (error) {
            console.error("Submission error:", error);
            toaster.push(<Message type="error" closable>{str('Submission failed.')}</Message>);
        } finally {
            setSubmitting(false);
        }
    };

    const types = ["bug", "issue", "question", "error", "request", "proposal"].map(
        item => ({ label: str(item), value: item })
    );

    return (
        <>
            <h2><Trans>Submit a Support Request</Trans></h2>
            <div style={{ maxWidth: '600px', margin: '30px auto', padding: '20px', border: '1px solid #e5e5e5', borderRadius: '8px', background: '#fff' }}>

                <label><Trans>Title</Trans></label>
                <Input value={title} onChange={setTitle} placeholder={str("Short summary of the issue")} />

                <label style={{ marginTop: '15px' }}><Trans>Description</Trans></label>
                <Input
                    as="textarea"
                    rows={4}
                    value={description}
                    onChange={setDescription}
                    placeholder={str("Detailed description")}
                />

                <label style={{ marginTop: '15px' }}><Trans>Type</Trans></label>
                <TagPicker block value={reqType.split(" ").filter(Boolean)} data={types} onChange={(val) => setReqType(val.join(" "))} placeholder={str("Choose request type")} />

                <label style={{ marginTop: '15px' }}><Trans>Contacts</Trans></label>
                <Input
                    value={contacts}
                    onChange={setContacts}
                    placeholder={str("Phone number, viber, telegram, email, etc.")}
                />
                
                <label style={{ marginTop: '15px', display: 'block' }}><Trans>Attachments</Trans></label>
                <CustomFileUploader 
                    attachments={attachments} 
                    setAttachments={setAttachments}
                    disabled={submitting}
                />

                <AppVersionBadge />

                {!submitted && (
                    <div style={{ marginTop: '20px' }}>
                        <Button appearance="primary" onClick={handleSubmit} loading={submitting} disabled={!reqType || !title || description.length < 2}>
                            <Trans>Submit</Trans>
                        </Button>
                    </div>
                )}

                {submitted && (
                    <Message showIcon type="success" header={str("Support request submitted successfully.")} style={{ marginTop: '15px' }} />
                )}
            </div>
        </>
    );
}

export default SupportRequestForm;
