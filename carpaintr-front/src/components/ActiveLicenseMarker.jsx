import React, { useEffect, useState } from 'react';
import { Loader, Tag } from 'rsuite';
import { authFetch } from '../utils/authFetch';

const ActiveLicenseMarker = () => {
    const [licenseStatus, setLicenseStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchLicenses = async () => {
            try {
                const response = await authFetch('/api/v1/getactivelicense');
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
        return <Loader content="Завантаження ліцензії..." />;
    }

    if (error) {
        console.log(error)
    }

    if (licenseStatus == null) {
        return <Tag color="grey">Завантаження ліцензії...</Tag>
    }

    return (
        <Tag color={licenseStatus["has_active_license"] ? "green" : "red"}>{licenseStatus["has_active_license"] ? `Ліцензія активна (Залишок днів: ${licenseStatus.license.days_left + 1})` : "Ліцензія неактивна"}</Tag>
    );
};

export default ActiveLicenseMarker;
