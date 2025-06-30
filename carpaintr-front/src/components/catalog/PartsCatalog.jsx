import { useCallback, useEffect, useState } from "react";
import { useLocale } from "../../localization/LocaleContext";
import { authFetch } from "../../utils/authFetch";
import ErrorMessage from "../layout/ErrorMessage";
import { Button } from "rsuite";

const PartsCatalog = () => {
    const [parts, setParts] = useState([]);
    const [errorText, setErrorText] = useState(null);
    const [errorTitle, setErrorTitle] = useState("");
    const { str } = useLocale();


    const handleError = useCallback((reason) => {
        console.error(reason);
        const title = str("Error");
        setErrorText(reason);
        setErrorTitle(title);
    }, [str]);

    useEffect(() => {
        authFetch('/api/v1/user/all_parts')
            .then(response => {
                if (response.status === 403) {
                    handleError("ERROR");
                    return null; // Stop here, don't try to parse JSON
                }
                if (!response.ok) {
                    throw new Error(`HTTP error ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (data) setParts(data); // Only set if data was parsed
            })
            .catch(handleError);
    }, [handleError]);

    return <div className="fade-in-simple">
        <ErrorMessage errorText={errorText} onClose={() => setErrorText(null)} title={errorTitle} />
        <div>
            {parts.map((part, i) => {
                return <Button appearance='link' style={{ display: "block" }} key={i}>{part}</Button>
            })}
        </div>
    </div>
}

export default PartsCatalog;