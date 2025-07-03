/* eslint-disable react/display-name */
import React, { useState, useEffect, useCallback } from 'react';
import { Button, VStack, Placeholder, PanelGroup, Panel, Divider, Input } from 'rsuite';
import { authFetch, authFetchYaml } from '../../utils/authFetch';
import SelectionInput from '../SelectionInput';
import { useSearchParams } from "react-router-dom"; // Import useSearchParams
import Trans from '../../localization/Trans';
import { useLocale, registerTranslations } from '../../localization/LocaleContext'; // Import registerTranslations
import { useGlobalCallbacks } from "../GlobalCallbacksContext"; // Ensure this context is stable
import './CarPaintEstimator.css';
import { capitalizeFirstLetter, handleOpenNewTab } from '../../utils/utils';
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