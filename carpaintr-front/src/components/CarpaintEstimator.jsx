import React, { useState, useEffect } from 'react';
import { SelectPicker, Button, DatePicker, Grid, Col, Row, VStack, Stack, Tabs, Placeholder } from 'rsuite';
import { authFetch, authFetchYaml } from '../utils/authFetch';
import SelectionInput from './SelectionInput'
import { Panel, PanelGroup, Toggle } from 'rsuite';
import CarBodyPartsSelector from './CarBodyPartsSelector';
import { useGlobalCallbacks } from "./GlobalCallbacksContext";
import ColorGrid from './ColorGrid';
import { useNavigate } from "react-router-dom";

// Parent component to hold only selected values
const CarPaintEstimator = () => {
    const { showReportIssueForm } = useGlobalCallbacks();
    const [make, setMake] = useState(null);
    const [model, setModel] = useState(null);
    const [year, setYear] = useState(null);
    const [bodyType, setBodyType] = useState(null);
    const [color, setColor] = useState(null);
    const [selectedParts, setSelectedParts] = useState([]);
    const [activePanel, setActivePanel] = useState(1);
    const [paintType, setPaintType] = useState(null);


    const activeKey = () => {
        if (make != null && year != null && model != null) {
            return 2
        }
        return 1
    }

    const handleSetYear = (year) => {
        setYear(year)
        setActivePanel(2)
    }

    const paintTypesAndTranslations = {
        "simple": "Без вкраплень",
        "metallic": "Металлік",
        "pearl": "Перламутр",
        "special": "Спец еффект"
    }

    return (
        <div>
            <Stack wrap justifyContent='space-between'>
                <h3>Розрахунок вартості ремонту</h3>
                <Button appearance="link" color="red" size="xs" onClick={showReportIssueForm}>
                    Повідомити про проблему
                </Button>
            </Stack>
            <PanelGroup accordion defaultActiveKey={activeKey()} activeKey={activePanel} bordered onSelect={(ev, a) => setActivePanel(ev)}>
                <Panel header={year == null ? "Автомобіль" : `${make} ${model} ${year}`} eventKey={1}>
                    <VehicleSelect selectedBodyType={bodyType} selectedMake={make} selectedModel={model} setMake={setMake} setBodyType={setBodyType} setModel={setModel} setYear={handleSetYear} />
                </Panel>
                <Panel header="Колір та тип фарби" eventKey={2}>
                    <ColorPicker setColor={setColor} selectedColor={color} />
                    <VStack justifyContent='center' alignItems='center' style={{ margin: "40px" }}>
                        <SelectionInput name="Тип фарби" values={Object.keys(paintTypesAndTranslations)} labels={paintTypesAndTranslations} selectedValue={paintType} onChange={setPaintType} placeholder="Select paint type" />
                    </VStack>
                    <Button onClick={() => setActivePanel(3)} disabled={paintType == null || color == null} color='green' appearance='primary'>Прийняти</Button>
                </Panel>
                <Panel header="Роботи" eventKey={3}>
                    {bodyType != null && <CarBodyPartsSelector selectedParts={selectedParts} onChange={setSelectedParts} />}
                </Panel>
                <Panel header="Додатково" eventKey={4}>
                    <CurrentDateDisplay />
                </Panel>
            </PanelGroup>
        </div>
    );
};

// 1. Vehicle Select Component
const VehicleSelect = ({ selectedBodyType, setBodyType, selectedMake, selectedModel, setMake, setModel, setYear }) => {
    const [makes, setMakes] = useState([]);
    const [models, setModels] = useState({});
    const [bodyTypes, setBodyTypes] = useState([]);

    const navigate = useNavigate();

    const handleError = (reason) => {
        console.error(reason)
        navigate("/cabinet");
    }

    useEffect(() => {
        authFetch('/api/v1/user/carmakes')
            .then(response => {
                if (response.status === 403) {
                    navigate("/cabinet");
                    return; // stop here, don't try to parse JSON
                }
                if (!response.ok) {
                    throw new Error(`HTTP error ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (data) setMakes(data); // only set if data was parsed
            })
            .catch(handleError);
    }, []);

    useEffect(() => {
        setBodyTypes([])
        setModel(null)
        setModels({})
        setBodyType(null)
        if (selectedMake == null) {
            return;
        }
        setModel(null); // Reset model selection on make change
        authFetch(`/api/v1/user/carmodels/${selectedMake}`)
            .then(response => response.json())
            .then(setModels)
            .catch(console.error);
    }, [selectedMake])

    const handleMakeSelect = (selectedMake) => {
        setMake(selectedMake);
    };

    const handleModelSelect = (selectedModel) => {
        setModel(selectedModel)
        console.log(`Model: ${selectedModel}`)
        console.log(`Model object: ${JSON.stringify(models[selectedModel])}`)
        if (models[selectedModel] != undefined) {
            setBodyTypes(models[selectedModel]["euro_body_types"])
        } else {
            setBodyTypes([])
            setBodyType(null)
        }
    }

    const modelOptions = Object.keys(models);

    const capitalizeFirstLetter = (val) => {
        return String(val).charAt(0).toUpperCase() + String(val).slice(1);
    }

    return (
        <div><Tabs defaultActiveKey="1" appearance="pills">
            <Tabs.Tab eventKey="1" title="Models" style={{width: "100%"}}>
                <SelectionInput name="Марка" values={makes} labelFunction={capitalizeFirstLetter} selectedValue={selectedMake} onChange={handleMakeSelect} placeholder="Select Make" />
                {selectedMake != null && <SelectionInput name="Модель" selectedValue={selectedModel} values={modelOptions} onChange={handleModelSelect} placeholder="Select Model" />}
                {selectedModel != null && <SelectionInput name="Тип кузова" selectedValue={selectedBodyType} values={bodyTypes} onChange={setBodyType} placeholder="Select Body Type" />}
            </Tabs.Tab>
            <Tabs.Tab eventKey="2" title="Type/Class">
                <Placeholder />
            </Tabs.Tab>

        </Tabs>
            <SelectPicker
                disabled={selectedModel == null}
                data={[...Array(30)].map((_, i) => ({ label: `${2024 - i}`, value: 2024 - i }))}
                onSelect={setYear}
                placeholder="Рік випуску"
            />
        </div>
    );
};

// 2. Current Date Display Component
const CurrentDateDisplay = () => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [season, setSeason] = useState(null);
    const [seasonDetails, setSeasonDetails] = useState(null);

    useEffect(() => {
        authFetch('/api/v1/user/season')
            .then(response => response.json())
            .then((data) => {
                setCurrentDate(new Date());
                setSeason(data.season_name === "summer" ? "Літо" : "Зима");
                setSeasonDetails(JSON.stringify(data));
            })
            .catch(console.error);
    }, []);

    return (
        <div>
            <DatePicker value={currentDate} disabled />
            <p>Розрахунковий сезон: {season}</p>
            <p><small>{JSON.stringify(seasonDetails)}</small></p>
        </div>
    );
};

// 4. Color Picker Component
const ColorPicker = ({ setColor, selectedColor }) => {
    const [baseColors, setBaseColors] = useState({});

    useEffect(() => {
        let fetchData = async () => {
            let data = await authFetchYaml('/api/v1/user/global/colors.yaml')
            setBaseColors(data)
        }
        fetchData()
    }, []);

    const displayColors = Object.keys(baseColors).map((key) => ({
        hex: baseColors[key].hex,
        colorName: key,
        id: key,
    })).sort((a, b) => a.hex.localeCompare(b.hex));

    return (
        <div>
            <ColorGrid colors={displayColors} selectedColor={selectedColor} onChange={setColor} />
        </div>
    );
};

export default CarPaintEstimator;
