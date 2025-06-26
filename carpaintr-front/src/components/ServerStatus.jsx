import React, { useEffect, useState } from 'react';
import { Loader, Message, Panel, useToaster, Button, Whisper, Tooltip, Table } from 'rsuite';
import { authFetch } from '../utils/authFetch';
import { useLocale } from '../localization/LocaleContext'; // Import useLocale and registerTranslations
import { parseISO, intervalToDuration } from 'date-fns'; // Import intervalToDuration

const ServerStatus = () => {
    const { str } = useLocale(); // Initialize useLocale hook
    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState(null);
    const [cache, setCache] = useState(null);

    useEffect(() => {
        setLoading(true);
        const fetchData = async () => {
            try {
                const response = await authFetch('/api/v1/admin/cache_status');
                if (!response.ok) {
                    throw new Error(`${str('Error: ')}${response.statusText}`);
                }
                const data = await response.json();
                setCache(data);
            } catch (err) {
                setMsg(<Message type="error" header="Error" closable>{err.message}</Message>);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [str]);

    let data = cache ? cache.map(item => {
        return {
            id: item[0],
            items: item[1],
            bytes: item[2]
        }
    }) : [];

    console.log(data);

    return (
        <Panel shaded>
            {msg && msg}
            <h4>Cache status</h4>
            {loading && <Loader />}
            <Table data={data} cellBordered style={{ backgroundColor: 'white' }}>
                <Table.Column width={200}>
                    <Table.HeaderCell>Cache type</Table.HeaderCell>
                    <Table.Cell dataKey="id" />
                </Table.Column >
                <Table.Column width={150}>
                    <Table.HeaderCell>Records</Table.HeaderCell>
                    <Table.Cell dataKey="items" />
                </Table.Column>
                <Table.Column width={150}>
                    <Table.HeaderCell>Bytes</Table.HeaderCell>
                    <Table.Cell dataKey="bytes" />
                </Table.Column>
            </Table>
        </Panel>
    );
}

export default ServerStatus;