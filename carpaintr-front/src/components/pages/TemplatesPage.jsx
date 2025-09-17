import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import TopBarUser from '../layout/TopBarUser';
import { Loader, Nav, SelectPicker } from 'rsuite';
import ErrorBoundary from '../../ErrorBoundary';
import { registerTranslations, useLocale } from '../../localization/LocaleContext';
import Trans from '../../localization/Trans';
import { authFetch } from '../../utils/authFetch';
import ErrorMessage from '../layout/ErrorMessage';
import { toRsuiteList } from '../../utils/utils';

registerTranslations("ua", {
    "Cars": "Автомобілі",
    "Parts": "Запчастини",
    "Data": "Дані",
    "Choose template:": "Оберіть документ:"
});



const TemplatesPage = () => {
    const [errorTitle, setErrorTitle] = useState("");
    const [errorText, setErrorText] = useState(null);
    const [templates, setTemplates] = useState([]);
    const [selectedTEmplate, setSelectedTemplate] = useState(null);

    const { str } = useLocale();


    const handleError = useCallback((reason) => {
            console.error(reason);
            const title = str("Error");
            setErrorText(reason);
            setErrorTitle(title);
        }, [str]);

    useEffect(() => {
            authFetch('/api/v1/user/list_templates')
                .then(response => {
                    if (response.status === 403) {
                        // navigate("/cabinet");
                        handleError("ERROR");
                        return null; // Stop here, don't try to parse JSON
                    }
                    if (!response.ok) {
                        throw new Error(`HTTP error ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    if (data) setTemplates(data); // Only set if data was parsed
                })
                .catch(handleError);
        }, [handleError]);



    return <div>
        <TopBarUser />
        <div className='fade-in-simple' style={{ maxWidth: '800px', margin: '0 auto', padding: '1em' }}>
            <ErrorMessage errorText={errorText} onClose={() => setErrorText(null)} title={errorTitle} />
            <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: "1rem", boxShadow: '0 2px 8px rgba(0,0,0,0.1)', minHeight: "260pt" }}>
                <p><Trans>Choose template:</Trans></p><SelectPicker value={selectedTEmplate} onChange={setSelectedTemplate} data={toRsuiteList(templates)}/>
            </div>
        </div>
    </div>;
};

export default TemplatesPage;
