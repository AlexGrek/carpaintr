import React, { useEffect, useState } from 'react';
import CarPaintEstimator from '../CarpaintEstimator';
import TopBarUser from '../layout/TopBarUser';

const CalcPage = () => {
    return <div><TopBarUser/><div style={{ maxWidth: '800px', margin: '0 auto', padding: '1em' }}>
        <CarPaintEstimator /></div>
    </div>
}

export default CalcPage