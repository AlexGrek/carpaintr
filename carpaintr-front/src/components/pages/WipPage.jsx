import React, { useEffect, useState } from 'react';
import CarPaintEstimator from '../CarpaintEstimator';
import TopBarUser from '../layout/TopBarUser';
import FileEditor from '../editor/FileEditor';

const WipPage = () => {
    return <div><TopBarUser/><div className='fade-in-simple' style={{ maxWidth: '800px', margin: '0 auto', padding: '1em' }}>
        <p>Додаток в розробці</p>
        </div>
    </div>
}

export default WipPage