import { useCallback, useEffect, useState } from "react";
import { useLocale } from "../../localization/LocaleContext";
import { authFetch } from "../../utils/authFetch";
import ErrorMessage from "../layout/ErrorMessage";
import { Button, Divider, Drawer, Loader, Modal, Panel, PanelGroup } from "rsuite";
import { useMediaQuery } from "react-responsive";
import PartLookup from "./PartLookup";
import ObjectBrowser from "../utility/ObjectBrowser";

const PartsCatalog = () => {
    const [parts, setParts] = useState([]);
    const [partsT2, setPartsT2] = useState([]);
    const [partsT2Errors, setPartsT2Errors] = useState([]);
    const [errorText, setErrorText] = useState(null);
    const [errorTitle, setErrorTitle] = useState("");
    const [chosenPart, setChosenPart] = useState(null);
    const { str } = useLocale();
    const isMobile = useMediaQuery({ maxWidth: 767 });
    const [isExpanded, setIsExpanded] = useState(false);


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
        authFetch('/api/v1/user/all_parts_t2')
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
                if (data) {
                    setPartsT2(data.data);
                    setPartsT2Errors(data.errors);
                }

            })
            .catch(handleError);
    }, [handleError]);

    return <div className="fade-in-simple">
        <ErrorMessage errorText={errorText} onClose={() => setErrorText(null)} title={errorTitle} />
        {parts.length == 0 && <Loader />}
        {partsT2Errors.length > 0 && <Panel shaded>Errors detected: <br /><pre>{JSON.stringify(partsT2Errors, null, 1)}</pre></Panel>}
        {partsT2.length > 0 && <PanelGroup accordion defaultActiveKey={0} bordered>
            {partsT2.map((part, i) => {
                return <Panel key={i} header={part.name ? `${part.group || ''} → ${part.name} [${part.zone}]` : `Unknown part ${i}`} eventKey={i}>
                    <ObjectBrowser jsonObject={part}></ObjectBrowser>
                </Panel>
            })}
        </PanelGroup>}
        <Divider />
        <div>
            {parts.map((part, i) => {
                return <Button appearance='link' style={{ display: "block" }} key={i} onClick={() => setChosenPart(part)}>{part}</Button>
            })}
        </div>
        <Modal size={(isMobile || isExpanded) ? 'full' : 'lg'} open={chosenPart !== null} onClose={() => setChosenPart(null)}>
            <Modal.Header>
                <Drawer.Title>{chosenPart}</Drawer.Title>
            </Modal.Header>
            <Modal.Body>
                {chosenPart != null && <PartLookup part={chosenPart} onExpand={() => setIsExpanded(true)} />}
            </Modal.Body>
        </Modal>
    </div>
}

export default PartsCatalog;