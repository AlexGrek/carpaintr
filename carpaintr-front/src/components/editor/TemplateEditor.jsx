import { useCallback, useEffect, useState } from "react";
import PropTypes from 'prop-types';
import { Tabs, Notification, Loader, useToaster, Message, Button, ButtonToolbar, ButtonGroup, Drawer, Input, Modal } from "rsuite";
import AceEditor from "react-ace";
import "ace-builds/src-noconflict/mode-json";
import "ace-builds/src-noconflict/mode-html";
import "ace-builds/src-noconflict/theme-github";
import { authFetch } from "../../utils/authFetch";
import { useLocale } from "../../localization/LocaleContext";
import Trans from "../../localization/Trans";

function TemplatePreview({ sampleJson, templateHtml }) {
    const [htmlPreview, setHtmlPreview] = useState('');
    const toaster = useToaster();

    const showMessage = useCallback((type, message) => {
        toaster.push(
            <Message type={type} closable>
                {message}
            </Message>,
            { placement: 'topEnd' }
        );
    }, [toaster]);

    const buildRequestPayload = useCallback((dataAsString, templateString) => {
        const data = JSON.parse(dataAsString);
        return {
            calculation: {
                car: data.car,
                paint: data.paint,
                order: data.order || {
                    orderDate: "2025-09-18T20:38:15.091Z",
                    orderNumber: "034423"
                },
                calc: data.calculations
            },
            metadata: {
                order_number: "034423",
                order_notes: "",
            },
            custom_template_content: templateString || null,
        };
    }, []);

    const { str } = useLocale();

    const handleGeneratePreview = useCallback(async () => {
        setHtmlPreview(''); // Clear previous preview
        try {
            const payload = buildRequestPayload(sampleJson, templateHtml);
            const response = await authFetch('/api/v1/user/generate_html_table', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'text/plain', // Request HTML preview
                },
                body: JSON.stringify(payload),
            });

            if (response.ok) {
                const html = await response.text();
                setHtmlPreview(html);
                showMessage('success', str('HTML preview generated successfully!'));
            } else {
                const errorText = await response.text();
                console.error("Failed to generate preview:", errorText);
                showMessage('error', `${str('Failed to generate preview:')} ${errorText}`);
                setHtmlPreview(`<p style="color: red;">${str('Failed to generate preview:')} ${errorText}</p>`);
            }
        } catch (error) {
            console.error("Error generating preview:", error);
            showMessage('error', `${str('Error generating preview:')} ${error.message}`);
            setHtmlPreview(`<p style="color: red;">${str('Error generating preview:')} ${error.message}</p>`);
        }
    }, [buildRequestPayload, sampleJson, templateHtml, showMessage, str]);


    return <div className="p-4 rounded-md shadow-sm bg-white">
        <h3 className="font-semibold mb-2">Preview</h3>
        <Button onClick={handleGeneratePreview}><Trans>Generate preview</Trans></Button>
        {htmlPreview && (
            <iframe
                title="Document Preview"
                className='pop-in-simple'
                style={{ width: '100%', minHeight: '500px', border: '1px solid #ddd', backgroundColor: "white" }}
                srcDoc={htmlPreview}
            />
        )}
    </div>
}

TemplatePreview.propTypes = {
    sampleJson: PropTypes.string,
    templateHtml: PropTypes.string
};

export default function TemplateEditor({ sample, template, onTemplateNewName }) {
    const [isLoading, setIsLoading] = useState(false);
    const [sampleJson, setSampleJson] = useState('');
    const [templateHtml, setTemplateHtml] = useState('');
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState("template");
    const [isSaveAsDrawerOpen, setIsSaveAsDrawerOpen] = useState(false);
    const [newTemplateName, setNewTemplateName] = useState(template);
    const toaster = useToaster();
    const { str } = useLocale();

    const handleSave = useCallback(async (saveValue, newName) => {
        if (!templateHtml) {
            toaster.push(<Notification type="error" header={str("Save Error")}>{str("No file path provided to save to.")}</Notification>, { placement: 'topEnd' });
            return;
        }

        if (!saveValue) {
            saveValue = templateHtml;
        }

        if (!newName) {
            newName = template;
        } else {
            setIsLoading(true);
        }

        const formData = new FormData();
        formData.append('file', new Blob([saveValue]), newName);
        if (saveValue === "[object Object]") { // Check for accidental object stringification
            toaster.push(<Notification type="error" header={str("Save Error")}>File corrupted by frontend</Notification>, { placement: 'topEnd' });
            return;
        }
        try {
            const response = await authFetch(`/api/v1/editor/upload_user_file/${encodeURIComponent(`doc_templates/${newName}`)}`, {
                method: 'POST',
                body: formData
            });
            if (!response.ok) {
                const errorData = await response.json();
                toaster.push(<Notification type="error" header={str("Save Error")}>{str("File not saved:")} {errorData.message || JSON.stringify(errorData)}</Notification>, { placement: 'topEnd' });
            } else {
                toaster.push(<Notification type="success" header={str("Success")}>{str("File saved")}</Notification>, { placement: 'topEnd' });
            }
        } catch (error) {
            toaster.push(<Notification type="error" header={str("Network Error")}>{str("Failed to save file:")} {error.message}</Notification>, { placement: 'topEnd' });
        }
        finally {
            setIsLoading(false);
            setIsSaveAsDrawerOpen(false)
            if (newName != template) {
                onTemplateNewName(newName)
            }
        }
    }, [onTemplateNewName, str, template, templateHtml, toaster]);

    const handleSaveWithNewName = useCallback(async () => {
        let newName = newTemplateName;
        if (!newName.endsWith(".html")) {
            newName = `${newName}.html`;
        }
        await handleSave(templateHtml, newName)
    }, [handleSave, newTemplateName, templateHtml])


    useEffect(() => {
        const fetchData = async () => {
            try {
                setIsLoading(true);
                const templateRes = await authFetch(`/api/v1/user/get_template/${template}`);
                if (!templateRes.ok) throw new Error(`Template fetch failed: ${templateRes.status}`);
                const templateText = await templateRes.text();
                setTemplateHtml(templateText);

                const sampleRes = await authFetch(`/api/v1/user/get_sample/${sample}`);
                if (!sampleRes.ok) throw new Error(`Sample fetch failed: ${sampleRes.status}`);
                const sampleText = await sampleRes.text();
                setSampleJson(sampleText);
            } catch (e) {
                setError(e.message);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
        setNewTemplateName(template);
    }, [sample, template]);

    return (
        <div className="flex flex-row md:flex-col h-full">
            <div className="flex-1 flex flex-col">
                <Modal size="sm" backdrop={true} open={isSaveAsDrawerOpen} onClose={() => setIsSaveAsDrawerOpen(false)}>
                    <Modal.Footer>
                        <Button appearance="primary" onClick={handleSaveWithNewName} disabled={newTemplateName == template}>
                            <Trans>Save</Trans>
                        </Button>
                    </Modal.Footer>
                    <Modal.Body>
                        <Input style={{ display: "block" }} value={newTemplateName} onChange={setNewTemplateName} />
                    </Modal.Body>
                </Modal>
                {error && <Notification type="error" header="Operation failed">{error}</Notification>}
                {isLoading ? <Loader center content="Loading..." /> : (
                    <Tabs appearance="pills" activeKey={activeTab} onSelect={setActiveTab}>
                        <Tabs.Tab eventKey="template" title="Template">
                            <ButtonGroup>
                                <Button onClick={() => handleSave()} appearance="primary">Save</Button>
                                <Button onClick={() => {
                                    setIsSaveAsDrawerOpen(true)
                                }}>Save As...</Button>
                            </ButtonGroup>
                            <AceEditor
                                mode="html"
                                theme="github"
                                name="template-editor"
                                width="100%"
                                height="400px"
                                value={templateHtml}
                                onChange={setTemplateHtml}
                                setOptions={{ useWorker: false }}
                            />
                        </Tabs.Tab>
                        <Tabs.Tab eventKey="sample" title="Sample">
                            <AceEditor
                                mode="json"
                                theme="github"
                                name="sample-editor"
                                width="100%"
                                height="400px"
                                value={sampleJson}
                                onChange={setSampleJson}
                                setOptions={{ useWorker: false }}
                            />
                        </Tabs.Tab>
                    </Tabs>
                )}
            </div>
            <div className="flex-1">
                <TemplatePreview sampleJson={sampleJson} templateHtml={templateHtml} />
            </div>
        </div>
    );
}

TemplateEditor.propTypes = {
    sample: PropTypes.string.isRequired,
    template: PropTypes.string.isRequired,
};
