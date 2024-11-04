import React, { useState, useEffect } from 'react';
import { SelectPicker, Button, DatePicker, Grid, Col, Row } from 'rsuite';
import { authFetch } from '../utils/authFetch';

// Parent component to hold only selected values
const CarPaintEstimator = () => {
    const [make, setMake] = useState(null);
    const [model, setModel] = useState(null);
    const [year, setYear] = useState(null);
    const [color, setColor] = useState(null);
    const [selectedParts, setSelectedParts] = useState([]);

    const handlePartSelection = (part) => {
        setSelectedParts((prev) =>
            prev.includes(part) ? prev.filter((p) => p !== part) : [...prev, part]
        );
    };

    return (
        <div>
            <p>Car paint estimator component</p>
            <VehicleSelect selectedMake={make} setMake={setMake} setModel={setModel} setYear={setYear} />
            <CurrentDateDisplay />
            {model != null && <CarParts handlePartSelection={handlePartSelection} selectedParts={selectedParts} />}
            {selectedParts.length > 0 && <ColorPicker setColor={setColor} selectedColor={color} />}
        </div>
    );
};

// 1. Vehicle Select Component
const VehicleSelect = ({ selectedMake, setMake, setModel, setYear }) => {
    const [makes, setMakes] = useState([]);
    const [models, setModels] = useState([]);

    useEffect(() => {
        authFetch('/api/v1/carmakes').then(response => response.json()).then(setMakes).catch(console.error);
    }, []);

    useEffect(() => {
        if (selectedMake == null) {
            return;
        }
        setModel(null); // Reset model selection on make change
        authFetch(`/api/v1/carmodels/${selectedMake}`)
            .then(response => response.json())
            .then(setModels)
            .catch(console.error);
    }, [selectedMake])

    const handleMakeSelect = (selectedMake) => {
        setMake(selectedMake);
    };

    const modelOptions = Object.keys(models).map((key) => ({
        label: `${key}`,
        value: key,
    }));

    return (
        <div>
            <SelectPicker data={makes.map(item => ({ label: item, value: item }))} onSelect={handleMakeSelect} placeholder="Select Make" />
            {selectedMake != null && <SelectPicker data={modelOptions} onSelect={setModel} placeholder="Select Model" />}
            <SelectPicker
                data={[...Array(30)].map((_, i) => ({ label: `${2024 - i}`, value: 2024 - i }))}
                onSelect={setYear}
                placeholder="Select Year"
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
        authFetch('/api/v1/season')
            .then(response => response.json())
            .then((data) => {
                setCurrentDate(new Date());
                setSeason(data.season);
                setSeasonDetails(data.details);
            })
            .catch(console.error);
    }, []);

    return (
        <div>
            <DatePicker value={currentDate} disabled />
            <p>Season: {season}</p>
            <p><small>{JSON.stringify(seasonDetails)}</small></p>
        </div>
    );
};

// 3. Car Parts Component
const CarParts = ({ handlePartSelection, selectedParts }) => {
    const parts = ['Hood', 'Roof', 'Left Door', 'Right Door', 'Trunk'];

    return (
        <Grid>
            {parts.map((part) => (
                <Col key={part} xs={4}>
                    <Button onClick={() => handlePartSelection(part)}>
                        {part}
                    </Button>
                    {selectedParts.includes(part) && <DummyComponent />}
                </Col>
            ))}
        </Grid>
    );
};

// Dummy Component for expanding car parts
const DummyComponent = () => <div style={{ padding: '10px', border: '1px solid gray' }}>Form for car part details</div>;

// 4. Color Picker Component
const ColorPicker = ({ setColor, selectedColor }) => {
    const [baseColors, setBaseColors] = useState({});

    useEffect(() => {
        authFetch('/api/v1/basecolors').then(response => response.json()).then(setBaseColors).catch(console.error);
    }, []);

    const displayColors = Object.keys(baseColors).map((key) => ({
        cssColor: baseColors[key].Hex,
        id: key,
    }));

    return (
        <Grid>
            <Row>
                {displayColors.map((color) => (
                    <Col key={color.id} xs={4}>
                        <div
                            style={{
                                width: '40px',
                                margin: '2px',
                                height: '40px',
                                backgroundColor: color.cssColor,
                                outline: selectedColor === color.id ? '2px solid black' : 'none',
                                cursor: 'pointer',
                            }}
                            onClick={() => setColor(color.id)}
                        />
                    </Col>
                ))}
            </Row>
        </Grid>
    );
};

export default CarPaintEstimator;
