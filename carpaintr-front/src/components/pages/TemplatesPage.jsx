import { useCallback, useEffect, useState } from 'react';
import TopBarUser from '../layout/TopBarUser';
import { Divider, SelectPicker } from 'rsuite';
import { registerTranslations, useLocale } from '../../localization/LocaleContext';
import Trans from '../../localization/Trans';
import { authFetch } from '../../utils/authFetch';
import ErrorMessage from '../layout/ErrorMessage';
import { toRsuiteList } from '../../utils/utils';
import TemplateEditor from '../editor/TemplateEditor';

registerTranslations("ua", {
    "Cars": "Автомобілі",
    "Parts": "Запчастини",
    "Data": "Дані",
    "Choose template:": "Оберіть документ:",
    "Choose sample:": "Оберіть приклад:",
    "Error": "Помилка"
});

const TemplatesPage = () => {
    const [errorTitle, setErrorTitle] = useState("");
    const [errorText, setErrorText] = useState(null);
    const [templates, setTemplates] = useState([]);
    const [samples, setSamples] = useState([]);
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [selectedSample, setSelectedSample] = useState(null);

    const { str } = useLocale();

    const handleError = useCallback((reason) => {
        console.error(reason);
        setErrorText(reason instanceof Error ? reason.message : String(reason));
        setErrorTitle(str("Error"));
    }, [str]);

    const fetchList = useCallback(async (endpoint, setter) => {
        try {
            const response = await authFetch(endpoint);
            if (response.status === 403) {
                handleError("Unauthorized");
                return;
            }
            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}`);
            }
            const data = await response.json();
            setter(data);
        } catch (err) {
            handleError(err);
        }
    }, [handleError]);

    useEffect(() => {
        fetchList('/api/v1/user/list_templates', setTemplates);
        fetchList('/api/v1/user/list_samples', setSamples);
    }, [fetchList]);

    return (
        <div>
            <TopBarUser />
            <div
                className="fade-in-simple"
                style={{ minWidth: '400px', margin: '0 auto', padding: '1em' }}
            >
                <ErrorMessage
                    errorText={errorText}
                    onClose={() => setErrorText(null)}
                    title={errorTitle}
                />
                <div
                    style={{
                        backgroundColor: 'white',
                        borderRadius: '8px',
                        padding: '1rem',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                        minHeight: '260pt',
                    }}
                >
                    <p><Trans>Choose template:</Trans></p>
                    <SelectPicker
                        value={selectedTemplate}
                        onChange={setSelectedTemplate}
                        data={toRsuiteList(templates)}
                    />

                    <p><Trans>Choose sample:</Trans></p>
                    <SelectPicker
                        value={selectedSample}
                        onChange={setSelectedSample}
                        data={toRsuiteList(samples)}
                    />

                    {selectedSample != null && selectedTemplate != null && <div>
                        <Divider />
                        <TemplateEditor sample={selectedSample} template={selectedTemplate} />
                    </div>}
                </div>
            </div>
        </div>
    );
};

export default TemplatesPage;
