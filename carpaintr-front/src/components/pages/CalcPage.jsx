import React, { useEffect, useState } from 'react';
import { Input, Message, Loader } from 'rsuite';
import { useNavigate } from 'react-router-dom';
import { authFetch } from '../../utils/authFetch';
import AdminTools from '../AdminTools';
import CarPaintEstimator from '../CarpaintEstimator';

const CalcPage = () => {
    return <div><h2>Car paint cost estimator</h2>
        <CarPaintEstimator /></div>
}

export default CalcPage