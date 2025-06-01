import React, { useEffect, useState } from 'react';
import { Loader, Message, Panel, useToaster, Button, Whisper, Tooltip } from 'rsuite';
import { authFetch } from '../utils/authFetch';
import Trans from '../localization/Trans'; // Import Trans component
import { useLocale, registerTranslations } from '../localization/LocaleContext'; // Import useLocale and registerTranslations
import { formatDistanceToNowStrict, parseISO } from 'date-fns';

registerTranslations('ua', {
});

const ServerLogs = () => {
    const [lines, setLines] = useState(100);
    const [log, setLog] = useState([]);
    const { str } = useLocale(); // Initialize useLocale hook
    const toaster = useToaster();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        const fetchData = async () => {
            try {
                const response = await authFetch('/api/v1/admin/logs?lines=' + lines);
                if (!response.ok) {
                    throw new Error(`${str('Error: ')}${response.statusText}`);
                }
                const data = await response.json();
                setLog(data);
            } catch (err) {
                toaster.push(<Message type="error" header="Error" closable duration={5000}>{err.message}</Message>);
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
                // Extract and parse the timestamp
                const timestampStr = part.substring(1, part.length - 1).replace(' UTC', '');
                let formattedTimeAgo = '';
                try {
                    const date = parseISO(timestampStr);
                    formattedTimeAgo = formatDistanceToNowStrict(date, { addSuffix: true });
                } catch (e) {
                    formattedTimeAgo = 'Invalid Date';
                }

                return (
                    <Whisper
                        key={index}
                        placement="top"
                        controlId={`whisper-${index}`}
                        trigger="hover"
                        speaker={<Tooltip>{formattedTimeAgo}</Tooltip>}
                    >
                        <span style={{ color: '#888', marginRight: '5px', cursor: 'help' }}>{part}</span>
                    </Whisper>
                );
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

    return (
        <Panel shaded>
            <p>Showing last <b>{lines}</b> log lines</p>
            <div style={{ fontFamily: 'monospace', fontSize: '0.85em', textAlign: 'left', backgroundColor: '#f5f5f5', padding: '10px', borderRadius: '5px', maxHeight: '500px', overflowY: 'auto' }}>
                {log.map((item, i) => {
                    return <p key={i} style={{ margin: '2px 0' }}>{parseAndStyleLogLine(item)}</p>
                })}
                {loading && <Loader center content="Loading..." />}
                {!loading && log.length === 0 && <p>No logs to display.</p>}
            </div>
            <div style={{ marginTop: '10px', textAlign: 'center' }}>
                <Button appearance='link' onClick={() => setLines(lines + 100)}>Load more...</Button>
            </div>
        </Panel>
    );
}

export default ServerLogs;