import React, { useEffect, useState } from 'react';
import { Panel, Grid, Row, Col, Loader, Tag } from 'rsuite';
import { authFetch } from '../utils/authFetch';
import Trans from '../localization/Trans';
import { useLocale } from '../localization/LocaleContext';

const ClientLicenseListing = () => {
    const [licenses, setLicenses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const isExpired = (expireDate) => new Date(expireDate) < new Date();

    useEffect(() => {
        const fetchLicenses = async () => {
            try {
                const response = await authFetch('/api/v1/getlicenses');
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
                {licenses.map((license, index) => (
                    <Col key={index} xs={24} sm={12} md={8} lg={6}>
                        <Panel bordered header={`License Code: ${license.code}`}>
                            <p><strong>Issued:</strong> {new Date(license.issued).toLocaleDateString()}</p>
                            <p><strong>Expires:</strong> {new Date(license.expire).toLocaleDateString()}</p>
                            <p><strong>Comment:</strong> {license.comment}</p>
                            <Tag color={isExpired(license.expire) ? 'red' : 'green'}>
                                {isExpired(license.expire) ? 'Expired' : 'Active'}
                            </Tag>
                        </Panel>
                    </Col>
                ))}
            </Row>
        </Grid>
    );
};

export default ClientLicenseListing;
