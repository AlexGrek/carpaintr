import { useCallback, useEffect, useState } from "react";
import { useLocale } from "../../localization/LocaleContext";
import { authFetch } from "../../utils/authFetch";
import ErrorMessage from "../layout/ErrorMessage";
import { Button, Drawer, Loader, Modal } from "rsuite";
import { useMediaQuery } from "react-responsive";
import PartLookup from "./PartLookup";

const PartsCatalog = () => {
    const [parts, setParts] = useState([]);
    const [errorText, setErrorText] = useState(null);
    const [errorTitle, setErrorTitle] = useState("");
    const [chosenPart, setChosenPart] = useState(null);
    const { str } = useLocale();
    const isMobile = useMediaQuery({ maxWidth: 767 });


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
        {parts.length == 0 && <Loader />}
        <div>
            {parts.map((part, i) => {
                return <Button appearance='link' style={{ display: "block" }} key={i} onClick={() => setChosenPart(part)}>{part}</Button>
            })}
        </div>
        <Modal size={isMobile ? 'full' : 'lg'} open={chosenPart !== null} onClose={() => setChosenPart(null)}>
            <Modal.Header>
                <Drawer.Title>{chosenPart}</Drawer.Title>
            </Modal.Header>
            <Modal.Body>
                {chosenPart != null && <PartLookup part={chosenPart} />}
            </Modal.Body>
        </Modal>
    </div>
}

export default PartsCatalog;