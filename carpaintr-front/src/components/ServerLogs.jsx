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

    const parseAndStyleLogLine = (line) => {
        const timestampRegex = /(\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3} UTC\])/;
        const userRegex = /(\[User: .+?\])/;

        const parts = line.split(timestampRegex);
        return parts.map((part, index) => {
            if (timestampRegex.test(part)) {
                return <span key={index} style={{ color: '#888', marginRight: '5px' }}>{part}</span>;
            } else {
                const userParts = part.split(userRegex);
                return userParts.map((userPart, userIndex) => {
                    if (userRegex.test(userPart)) {
                        return <span key={`${index}-${userIndex}`} style={{ color: '#007bff', fontWeight: 'bold', marginRight: '5px' }}>{userPart}</span>;
                    } else {
                        return <span key={`${index}-${userIndex}`}>{userPart}</span>;
                    }
                });
            }
        });
    };

    return <Panel shaded>
        <p>Showing last <b>{lines}</b> log lines</p>
        <div style={{ fontFamily: 'monospace', fontSize: '0.85em', textAlign: 'left', backgroundColor: '#f5f5f5', padding: '10px', borderRadius: '5px' }}>
            {log.map((item, i) => {
                return <p key={i} style={{ margin: '2px 0' }}>{parseAndStyleLogLine(item)}</p>
            })}
            {loading && <Loader />}
            <Button appearance='link' onClick={() => setLines(lines + 100)} style={{ marginTop: '10px' }}>Load more...</Button>
        </div>
    </Panel>
}

export default ServerLogs;