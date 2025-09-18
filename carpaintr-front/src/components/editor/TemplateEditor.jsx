import { useEffect, useState } from "react";
import PropTypes from 'prop-types';
import { Tabs, Notification, Loader } from "rsuite";
import AceEditor from "react-ace";

// Import ace editor modes/themes
import "ace-builds/src-noconflict/mode-json";
import "ace-builds/src-noconflict/mode-html";
import "ace-builds/src-noconflict/theme-github";
import { authFetch } from "../../utils/authFetch";

function TemplatePreview({ sampleJson, templateHtml }) {
    return <div className="p-4 border rounded-md shadow-sm bg-white">
        <h3 className="font-semibold mb-2">Preview (stub)</h3>
        <p>Preview will be implemented later.</p>
    </div>
}

TemplatePreview.propTypes = {
    sampleJson: PropTypes.string,
    templateHtml: PropTypes.string
};

export default function TemplateEditor({ sample, template }) {
    const [customTemplateContent, setCustomTemplateContent] = useState('');
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
