import React, { useEffect, useState } from 'react';
import CarPaintEstimator from '../CarpaintEstimator';
import TopBarUser from '../layout/TopBarUser';
import { useNavigate } from 'react-router-dom';
import { Content, Panel, Button } from 'rsuite';
import ActiveLicenseMarker from '../ActiveLicenseMarker';

const UsersDashboard = () => {
    return <div><TopBarUser/><div style={{ maxWidth: '800px', margin: '0 auto', padding: '1em' }}>
        <Dashboard /></div>
    </div>
}

const Dashboard = () => {
    let nav = useNavigate();

    return <Content>
        <Panel>
            <ActiveLicenseMarker/>
            <br/>
            <DashboardNavigationButtons/>
        </Panel>
        </Content>
}

const DashboardNavigationButtons = () => {
    const features = [
        {
            icon: "🖩",
            title: "Calculation",
            description: "Price estimation calculator.",
            link: "/calc"
        },
        {
            icon: "📋",
            title: "Task Tracking",
            description: "🚧 Under construction 🚧",
            link: "/wip"
        },
        {
            icon: "🤖",
            title: "AI Analytics",
            description: "🚧 Under construction 🚧",
            link: "/wip"
        },
        {
            icon: "🛅",
            title: "Customization",
            description: "Your business, your rules.",
            link: "/fileeditor"
        },
        {
            icon: "🪙",
            title: "Your organization",
            description: "Manage access and licensing.",
            link: "/cabinet"
        },
    ];

    return (
        <section className="apps-list">
            <div className="container">
                <div className="section-header">
                    <h2>Available apps</h2>
                </div>
                <div className="features-grid">
                    {features.map((feature, index) => (
                        <FeatureCard
                            key={index}
                            icon={feature.icon}
                            title={feature.title}
                            description={feature.description}
                            link={feature.link}
                        />
                    ))}
                </div>
            </div>
        </section>
    );
};

const FeatureCard = ({ icon, title, description, link }) => {
    const nav = useNavigate();
    return (
        <div className="feature-card app-card" style={{cursor: 'pointer'}} onClick={() => nav(link)}>
            <div className="feature-icon">{icon}</div>
            <h3>{title}</h3>
            <p>{description}</p>
        </div>
    );
};

export default UsersDashboard