import React, { useEffect, useState } from 'react';
import CarPaintEstimator from '../CarpaintEstimator';
import TopBarUser from '../layout/TopBarUser';
import FileEditor from '../editor/FileEditor';

const FileEditorPage = () => {
    return <div><TopBarUser/><div style={{ maxWidth: '800px', margin: '0 auto', padding: '1em' }}>
        <FileEditor /></div>
    </div>
}

export default FileEditorPage