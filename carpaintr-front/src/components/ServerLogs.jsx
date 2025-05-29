import React, { useEffect, useState } from 'react';
import { Button, ButtonGroup, Drawer, Panel } from 'rsuite';
import { authFetch } from '../utils/authFetch';
import ReloadIcon from '@rsuite/icons/Reload';
import LicenseManager from './LicenseManager';
import Trans from '../localization/Trans'; // Import Trans component
import { useLocale, registerTranslations } from '../localization/LocaleContext'; // Import useLocale and registerTranslations

registerTranslations('ua', {
});

const ServerLogs = () => {
    const [lines, setLines] = useState(100)
    const [log, setLog] = useState([])

    const fetchData = async () => {
        const { str } = useLocale(); // Initialize useLocale hook

        try {
            const response = await authFetch('/api/v1/admin/logs?lines=' + lines);
            if (!response.ok) {
                throw new Error(`${str('Error: ')}${response.statusText}`);
            }
            const data = await response.json();
            setLogs(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [str]); // Add str to dependency array

    return <div>
        <p>Showing last <b>{lines}</b> log lines</p>
        <code>
            {log.map((item, i) => {
                return <p key={i}>{item}</p>
            })}
        </code>
    </div>
}

export default ServerLogs;