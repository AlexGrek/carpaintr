import React, { useEffect, useState } from 'react';
import { Grid, Row, Loader } from 'rsuite';
import { authFetch } from '../utils/authFetch';
import LicenseBadge from './license/LicenseBadge';

const ClientLicenseListing = () => {
    const [licenses, setLicenses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchLicenses = async () => {
            try {
                const response = await authFetch('/api/v1/mylicenses');
                if (!response.ok) {
                    throw new Error(`Error: ${response.statusText}`);
                }
                const data = await response.json();
                setLicenses(Object.values(data));
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchLicenses();
    }, []);

    if (loading) {
        return <Loader center content="Loading licenses..." />;
    }

    if (error) {
        console.log(error)
    }

    return (
        <Grid>
            <Row gutter={16}>
                {licenses.map((license, index) => <LicenseBadge key={index} licenseClass={license.level} expired={license.days_left <= 0} timeLeft={license.days_left} />
                )}
            </Row>
        </Grid>
    );
};

export default ClientLicenseListing;
