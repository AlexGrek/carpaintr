import React, { useEffect, useState } from 'react';
import { Loader, Tag } from 'rsuite';
import { authFetch } from '../utils/authFetch';

const ActiveLicenseMarker = () => {
    const [licenseStatus, setLicenseStatus] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchLicenses = async () => {
            try {
                const response = await authFetch('/api/v1/haveactivelicense');
                if (!response.ok) {
                    throw new Error(`Error: ${response.statusText}`);
                }
                const data = await response.json();
                setLicenseStatus(data);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchLicenses();
    }, []);

    if (loading) {
        return <Loader center content="Завантаження ліцензії..." />;
    }

    if (error) {
        console.log(error)
    }

    return (
        <Tag color={licenseStatus ? "green" : "red"}>{licenseStatus ? "Ліцензія активна" : "Ліцензія не активна"}</Tag>
    );
};

export default ActiveLicenseMarker;
