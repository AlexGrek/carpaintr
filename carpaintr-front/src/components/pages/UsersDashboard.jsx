// UsersDashboard.jsx
import { useEffect, useState } from 'react';
import TopBarUser from '../layout/TopBarUser';
import { useNavigate } from 'react-router-dom';
import { Content, Panel, Text, Message, Dropdown, Button } from 'rsuite';
import ActiveLicenseMarker from '../ActiveLicenseMarker';
import Trans from '../../localization/Trans';
import { useLocale, registerTranslations } from '../../localization/LocaleContext';
import { getCompanyInfo, fetchCompanyInfo } from '../../utils/authFetch';
import './UsersDashboard.css'
import { BrainCircuit, Calculator, Cog, FileCheck, FileCode, Grid2X2, Grip, LayoutGrid, Rows3 } from 'lucide-react';

registerTranslations('ua', {
    "Calculation": "Розрахунок",
    "Price estimation calculator": "Калькулятор оцінки вартості",
    "Task Tracking": "Відстеження завдань",
    "Under construction": "У розробці",
    "AI Analytics": "Аналітика ШІ",
    "Customization": "Персоналізація",
    "Customize everything": "Глибокі налаштування",
    "Your organization": "Ваша організація",
    "Manage access and licensing": "Керування доступом та ліцензуванням",
    "Available apps": "Доступні програми",
    "Your company": "Ваша компанiя",
    "As list": "У вигляді списку",
    "As grid": "У вигляді сітки", // New translation
    "As blocks": "У вигляді блоків", // New translation
});

const UsersDashboard = () => {
    return <div><TopBarUser /><div style={{ maxWidth: '800px', margin: '0 auto', padding: '1em' }}>
        <Dashboard /></div>
    </div>
}

const Dashboard = () => {
    const [company, setCompany] = useState(null);
    const [message, setMessage] = useState(null);
    const { str, setLang } = useLocale();

    useEffect(() => {
        if (getCompanyInfo() != null) {
            setCompany(getCompanyInfo());
            return;
        }

        const reportError = (err) => {
            console.error(err);
            setMessage({ "type": "error", "title": str("Failed to get company info"), "message": `${err}` });
            setTimeout(() => setMessage(null), 3000);
        }

        const fetchAsync = async () => {
            const data = await fetchCompanyInfo(reportError);
            if (data) {
                setCompany(data);
                if (data.lang_ui) {
                    setLang(data.lang_ui)
                }
            }
        }

        fetchAsync();
    }, [str, setLang])

    return <Content>
        <Panel>
            {message && <Message showIcon type={message.type} header={message.title}>{message.message}</Message>}
            <ActiveLicenseMarker />
            <br />
            <Panel header={str("Your company")} shaded className='fade-in-simple'>
                <h2>{company && company.company_name}</h2>
                <Text muted>{company && company.email}</Text>
            </Panel>
            <DashboardNavigationButtons />
        </Panel>
    </Content>
}

const DashboardNavigationButtons = () => {
    const { str } = useLocale();
    const [viewMode, setViewMode] = useState(() => localStorage.getItem('appViewMode') || 'list');

    useEffect(() => {
        localStorage.setItem('appViewMode', viewMode);
    }, [viewMode]);

    const features = [
        {
            icon: <Calculator />,
            title: str("Calculation"),
            description: str("Price estimation calculator"),
            link: "/calc"
        },
        {
            icon: <FileCheck />,
            title: str("Task Tracking"),
            description: "🚧 " + str("Under construction") + " 🚧",
            link: "/wip"
        },
        {
            icon: <BrainCircuit />,
            title: str("AI Analytics"),
            description: "🚧 " + str("Under construction") + " 🚧",
            link: "/wip"
        },
        {
            icon: <FileCode />,
            title: str("Customization"),
            description: str("Customize everything"),
            link: "/fileeditor"
        },
        {
            icon: <Cog />,
            title: str("Your organization"),
            description: str("Manage access and licensing"),
            link: "/cabinet"
        },
    ];


    const renderIconButton = (props, ref) => {
        return (
            <Button {...props} ref={ref} circle ><LayoutGrid /></Button>
        );
    };

    const handleSelectViewMode = (eventKey) => {
        setViewMode(eventKey);
    };

    return (
        <section className="apps-list">
            <div className="apps-list-container">
                <div className="apps-list-section-header">
                    <p><Trans>Available apps</Trans></p>
                    <Dropdown placement="leftStart" renderToggle={renderIconButton} trigger='click' onSelect={handleSelectViewMode}>
                        <Dropdown.Item eventKey='list'><p className='app-list-view-mode'><Rows3 /><Trans>As list</Trans></p></Dropdown.Item>
                        <Dropdown.Item eventKey='grid'><p className='app-list-view-mode'><Grip /><Trans>As grid</Trans></p></Dropdown.Item>
                        <Dropdown.Item eventKey='blocks'><p className='app-list-view-mode'><Grid2X2 /><Trans>As blocks</Trans></p></Dropdown.Item>
                    </Dropdown>
                </div>
                <div className={`features-grid ${viewMode}-view`}>
                    {features.map((feature, index) => {
                        if (viewMode === 'grid') {
                            return (
                                <AppCardCompact
                                    key={index}
                                    icon={feature.icon}
                                    title={feature.title}
                                    link={feature.link}
                                />
                            );
                        } else {
                            return (
                                <AppCard
                                    key={index}
                                    icon={feature.icon}
                                    title={feature.title}
                                    description={feature.description}
                                    link={feature.link}
                                />
                            );
                        }
                    })}
                </div>
            </div>
        </section>
    );
};

const AppCard = ({ icon, title, description, link }) => {
    const nav = useNavigate();
    return (
        <div className="app-card" style={{ cursor: 'pointer' }} onClick={() => nav(link)}>
            <div className="app-feature-icon">{icon}</div>
            <h3>{title}</h3>
            <p className='fade-in-simple'>{description}</p>
        </div>
    );
};

const AppCardCompact = ({ icon, title, link }) => {
    const nav = useNavigate();
    return (
        <div className="app-card compact-app-card" style={{ cursor: 'pointer' }} onClick={() => nav(link)}>
            <div className="app-feature-icon">{icon}</div>
            <h3>{title}</h3>
        </div>
    );
};

export default UsersDashboard;