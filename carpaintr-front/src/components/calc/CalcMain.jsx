/* eslint-disable react/display-name */
import React, { useState } from 'react';
import './CarPaintEstimator.css';
import './calc_translations';
import StageView from '../layout/StageView';
import { AppWindowMac, Car, CarFront, Paintbrush, Table2 } from 'lucide-react';
import CalcMainMenuStage from './CalcMainMenuStage';

const stages = [
    {
        name: 'carSelectStage',
        title: 'Car select',
        icon: CarFront,
        component: React.lazy(() => import('./CarSelectStage')),
    },
    {
        name: 'paintSelectStage',
        title: 'Paint select',
        icon: Paintbrush,
        component: React.lazy(() => import('./ColorSelectStage')),
    },
    {
        name: 'bodyPartsSelectStage',
        title: 'Body parts',
        icon: Car,
        component: React.lazy(() => import('./BodyPartsStage')),
    },
    {
        name: 'tableStage',
        title: 'Finalize',
        icon: Table2,
        component: React.lazy(() => import('./TableFinalStage')),
    },
]

// Main Parent component
const CalcMain = ({ setChanges }) => {
    const [isMainMenuStage, setIsMainMenuStage] = useState(true);
    return isMainMenuStage ? <CalcMainMenuStage onNext={() => setIsMainMenuStage(false)}/> : <StageView initialState={{}} stages={stages} />
};

export default CalcMain;