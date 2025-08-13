/* eslint-disable react/display-name */
import React, { useCallback, useEffect, useState } from "react";
import { useLocale } from "../../localization/LocaleContext";
import { useNavigate } from "react-router-dom";
import { isArray, isObjectLike } from "lodash";
import { authFetch, authFetchYaml } from "../../utils/authFetch";
import ErrorMessage from "../layout/ErrorMessage";
import { Button, Input, Loader, Modal, SelectPicker, Tabs } from "rsuite";
import SelectionInput from "../SelectionInput";
import { capitalizeFirstLetter } from "../../utils/utils";
import MenuPickerV2 from "../layout/MenuPickerV2";
import Trans from "../../localization/Trans";
import { tryDecodeVin } from "../../vindecoder";

// Pre-map static lists for SelectPicker data to avoid re-mapping on every render
const CAR_CLASS_OPTIONS = [
    "A", "B", "C", "D", "E", "F", "SUV 1", "SUV 2", "SUV MAX"
].map((i) => ({ label: i, value: i }));

const VehicleSelect = React.memo(({ selectModelMode, setSelectModelMode, selectedBodyType, vin, setVin, setBodyType, selectedMake, selectedModel, year, setMake, setModel, setYear, carclass, setCarClass, isFromLoading }) => {
    const [makes, setMakes] = useState([]);
    const [bodyPartsClassMapping, setBodyPartsClassMapping] = useState(null);
    const [carBodyTypesOptions, setCarBodyTypesOptions] = useState([]);
    const [models, setModels] = useState({});
    const [bodyTypes, setBodyTypes] = useState([]);
    const { str, labels } = useLocale();
    const navigate = useNavigate();
    const [errorText, setErrorText] = useState(null);
    const [vinDecoderOpen, setVinDecoderOpen] = useState(false);
    const [vinDecoderLoading, setVinDecoderLoading] = useState(false);
    const [vinDecoded, setVinDecoded] = useState(null);
    const [errorTitle, setErrorTitle] = useState("");

    const handleError = useCallback((reason) => {
        console.error(reason);
        const title = str("Error");
        setErrorText(reason);
        setErrorTitle(title);
    }, [str]);

    const getCarBodyTypeOptions = useCallback((carclass, bodyPartsClassMapping) => {
        if (bodyPartsClassMapping == null || !carclass) {
            return [];
        }
        if (!bodyPartsClassMapping || !isObjectLike(bodyPartsClassMapping)) {
            handleError("Wrong type in getCarBodyTypeOptions: " + JSON.stringify(bodyPartsClassMapping))
            return [];
        }
        if (!Object.hasOwn(bodyPartsClassMapping, carclass)) {
            handleError(`Cannot find key for ${carclass} in getCarBodyTypeOptions: ` + JSON.stringify(bodyPartsClassMapping))
            return [];
        }
        if (!isArray(bodyPartsClassMapping[carclass])) {
            handleError(`Error for ${carclass} in getCarBodyTypeOptions: ` + JSON.stringify(bodyPartsClassMapping[carclass]))
            return [];
        }
        return bodyPartsClassMapping[carclass];
    }, [handleError])

    useEffect(() => {
        const variants = getCarBodyTypeOptions(carclass, bodyPartsClassMapping);
        const options = variants.map(opt => ({ label: str(opt), value: opt }));
        setCarBodyTypesOptions(options);
        if (selectedBodyType != null && variants.length > 0 && !variants.includes(selectedBodyType)) {
            if (selectedModel != null) {
                // unsupported class
                handleError(`Unsupported body type '${str(selectedBodyType)}' for ${carclass} class`);
            } else {
                setBodyType(null); // impossible (or unsupported) body type for this class
            }
        }
    }, [bodyPartsClassMapping, carclass, getCarBodyTypeOptions, handleError, selectedBodyType, selectedModel, setBodyType, str])

    useEffect(() => {
        authFetch('/api/v1/user/carmakes')
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
                if (data) setMakes(data); // Only set if data was parsed
            })
            .catch(handleError);
    }, [navigate, handleError]);

    useEffect(() => {
        authFetchYaml('/api/v1/user/list_class_body_types', onerror = handleError)
            .then(data => {
                if (data) setBodyPartsClassMapping(data); // Only set if data was parsed
            })
            .catch(handleError);
    }, [handleError]);

    useEffect(() => {
        setBodyTypes([]);
        if (!isFromLoading) {
            // setModel(null);
            // setBodyType(null);
        }

        // setModels({});

        if (selectedMake === null) {
            return;
        }
        authFetch(`/api/v1/user/carmodels/${selectedMake}`)
            .then(response => response.json())
            .then(setModels)
            .catch(console.error);
    }, [selectedMake, setModel, setBodyTypes, setBodyType, setModels, isFromLoading]); // Explicit dependencies

    const handleMakeSelect = useCallback((make) => {
        setMake(make);
    }, [setMake]);

    const handleModelSelect = useCallback((model) => {
        setModel(model);
        console.log(`Model: ${model}`);
        console.log(`Model object: ${JSON.stringify(models[model])}`);
        if (models[model] !== undefined) {
            setBodyTypes(models[model]["euro_body_types"]);
            setCarClass(models[model]["euro_class"]);
        } else {
            setBodyTypes([]);
            setBodyType(null);
        }
    }, [setModel, models, setBodyTypes, setCarClass, setBodyType]);

    const modelOptions = Object.keys(models).sort();

    const handleVinDecode = useCallback(async () => {
        setVinDecoderLoading(true);
        let decoded = await tryDecodeVin(vin);
        setVinDecoded(JSON.stringify(decoded, null, 2));
        if (decoded.bodyType) {
            setBodyType(decoded.bodyType.toLowerCase())
        }
        setVinDecoderLoading(false);
        if (decoded.make) {
            if (decoded.model) {
                setModel(decoded.model.toLowerCase())
            }
            setMake(decoded.make.toLowerCase());
            setSelectModelMode(true);
        }
        if (decoded.year) {
            setYear(decoded.year)
        }
    }, [setBodyType, setMake, setModel, setSelectModelMode, setYear, vin])

    return (
        <div>
            <ErrorMessage errorText={errorText} onClose={() => setErrorText(null)} title={errorTitle} />
            <article style={{ margin: "0 auto" }}>
                {selectModelMode && <div title={str("Models")} style={{ width: "100%" }}>
                    <SelectionInput mode="select" name={str("Make")} values={makes} labelFunction={capitalizeFirstLetter} selectedValue={selectedMake} onChange={handleMakeSelect} placeholder={str("Select Make")} />
                    <br />
                    {!selectedMake && !selectedModel && <p>
                        Оберіть модель автомобіля або <a href="#" onClick={() => setSelectModelMode(false)}>вкажіть тип вручну</a>.
                    </p>}
                    {selectedMake !== null && <SelectionInput mode="select" name={str("Model")} selectedValue={selectedModel} values={modelOptions} onChange={handleModelSelect} placeholder={str("Select Model")} />}
                    <br />
                    {selectedModel !== null && <SelectionInput name={str("Body Type")} labelFunction={str} selectedValue={selectedBodyType} values={labels(bodyTypes)} onChange={setBodyType} placeholder={str("Select Body Type")} />}
                </div>}
                {!carclass && !selectModelMode && <>
                    <p>
                        Оберіть тип автомобіля або <a href="#" onClick={() => setSelectModelMode(true)}>модель</a>.
                    </p>
                    <p>
                        Спробувати <a href="#" onClick={() => setVinDecoderOpen(true)}>декодувати VIN код</a>.
                    </p>
                    <Modal open={vinDecoderOpen} onClose={() => setVinDecoderOpen(false)}>
                        <Modal.Header>Декодер VIN (на стадії розробки)</Modal.Header>
                        <Modal.Body>
                            <Input value={vin} onChange={setVin} placeholder="VIN"></Input>
                            <Button appearance="primary" disabled={vin.length != 17 || vinDecoderLoading} onClick={handleVinDecode}>Декодувати</Button>
                            <pre>{vinDecoded}</pre>
                            {vinDecoderLoading && <Loader />}
                        </Modal.Body>
                        <Modal.Footer>
                            <Button appearance="subtle" onClick={() => setVinDecoderOpen(false)}>Закрити</Button>
                        </Modal.Footer>
                    </Modal>
                </>}
                {!selectModelMode &&
                    <div title={str("Type/Class")}>
                        <MenuPickerV2
                            items={CAR_CLASS_OPTIONS}
                            onSelect={setCarClass}
                            value={carclass}
                            label={str("CLASS")}
                        />
                        <br />
                        {carclass && <MenuPickerV2
                            items={carBodyTypesOptions}
                            onSelect={setBodyType}
                            value={selectedBodyType}
                            label={str("BODY TYPE")}
                        />}
                    </div>}
            </article>
            {(selectedModel !== null || (carclass !== null && selectedBodyType !== null)) && <SelectPicker
                disabled={!(selectedModel !== null || (carclass !== null && selectedBodyType !== null))}
                data={[...Array(40)].map((_, i) => {
                    let y = `${2024 - i}`;
                    return { label: y, value: y };
                })}
                onSelect={setYear}
                value={year}
                placeholder={str("Year of manufacture")}
                searchable={false}
            />}
        </div>
    );
});

export default VehicleSelect;
