/* eslint-disable react/display-name */
import React from 'react';
import './CarPaintEstimator.css';
import './calc_translations';
import StageView from '../layout/StageView';
import { AppWindowMac, CarFront, Paintbrush } from 'lucide-react';
import CalcMainMenuStage from './CalcmainMenuStage';

const stages = [
    {
        name: 'mainMenu',
        title: 'Menu',
        icon: AppWindowMac,
        component: CalcMainMenuStage,
    },
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
]

// Main Parent component
const CalcMain = ({ setChanges }) => {
    return <StageView initialState={{}} stages={stages} />
};

export default CalcMain;