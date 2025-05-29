import React, { useEffect, useState } from 'react';
import { Loader, Message, Panel, useToaster, Button } from 'rsuite';
import { authFetch } from '../utils/authFetch';
import Trans from '../localization/Trans'; // Import Trans component
import { useLocale, registerTranslations } from '../localization/LocaleContext'; // Import useLocale and registerTranslations

registerTranslations('ua', {
});

const ServerLogs = () => {
    const [lines, setLines] = useState(100)
    const [log, setLog] = useState([])
    const { str } = useLocale(); // Initialize useLocale hook
    const toaster = useToaster();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true)
        const fetchData = async () => {
            try {
                const response = await authFetch('/api/v1/admin/logs?lines=' + lines);
                if (!response.ok) {
                    throw new Error(`${str('Error: ')}${response.statusText}`);
                }
                const data = await response.json();
                setLog(data);
            } catch (err) {
                toaster.push(<Message>{err.message}</Message>);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [str, lines, toaster]); // Add str to dependency array

    return <Panel shaded>
        <p>Showing last <b>{lines}</b> log lines</p>
        <code>
            {log.map((item, i) => {
                return <p key={i}>{item}</p>
            })}
            {loading && <Loader />}
            <Button appearance='link' onClick={() => setLines(lines + 100)}>Load more...</Button>
        </code>
    </Panel>
}

export default ServerLogs;