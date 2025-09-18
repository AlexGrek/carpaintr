import { useCallback, useEffect, useState } from "react";
import PropTypes from 'prop-types';
import { Tabs, Notification, Loader, useToaster, Message, Button } from "rsuite";
import AceEditor from "react-ace";

// Import ace editor modes/themes
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
            <Message type={type} closable duration={5000}>
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


    return <div className="p-4 border rounded-md shadow-sm bg-white">
        <h3 className="font-semibold mb-2">Preview (stub)</h3>
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

export default function TemplateEditor({ sample, template }) {
    const [isLoading, setIsLoading] = useState(false);
    const [sampleJson, setSampleJson] = useState('');
    const [templateHtml, setTemplateHtml] = useState('');
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState("template");

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
    }, [sample, template]);

    return (
        <div className="flex flex-col md:flex-row gap-4 h-full">
            <div className="flex-1 flex flex-col">
                {error && <Notification type="error" header="Operation failed">{error}</Notification>}
                {isLoading ? <Loader center content="Loading..." /> : (
                    <Tabs activeKey={activeTab} onSelect={setActiveTab}>
                        <Tabs.Tab eventKey="template" title="Template">
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
