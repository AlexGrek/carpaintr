import { useEffect, useState } from 'react';
import TopBarUser from '../layout/TopBarUser';
import { useNavigate } from 'react-router-dom';
import { Content, Panel, Text, Message } from 'rsuite';
import ActiveLicenseMarker from '../ActiveLicenseMarker';
import Trans from '../../localization/Trans';
import { useLocale, registerTranslations } from '../../localization/LocaleContext';
import { getCompanyInfo, fetchCompanyInfo } from '../../utils/authFetch';
import './UsersDashboard.css'

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
    "Your company": "Ваша компанiя"
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
    const features = [
        {
            icon: "🧮",
            title: str("Calculation"),
            description: str("Price estimation calculator"),
            link: "/calc"
        },
        {
            icon: "📋",
            title: str("Task Tracking"),
            description: "🚧 " + str("Under construction") + " 🚧",
            link: "/wip"
        },
        {
            icon: "🤖",
            title: str("AI Analytics"),
            description: "🚧 " + str("Under construction") + " 🚧",
            link: "/wip"
        },
        {
            icon: "🛅",
            title: str("Customization"),
            description: str("Customize everything"),
            link: "/fileeditor"
        },
        {
            icon: "🪙",
            title: str("Your organization"),
            description: str("Manage access and licensing"),
            link: "/cabinet"
        },
    ];

    return (
        <section className="apps-list">
            <div className="container">
                <div className="section-header">
                    <h2 className='fade-in-simple'><Trans>Available apps</Trans></h2>
                </div>
                <div className="features-grid">
                    {features.map((feature, index) => (
                        <AppCard
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

const AppCard = ({ icon, title, description, link }) => {
    const nav = useNavigate();
    return (
        <div className="app-card" style={{ cursor: 'pointer' }} onClick={() => nav(link)}>
            <div className="feature-icon">{icon}</div>
            <h3>{title}</h3>
            <p className='fade-in-simple'>{description}</p>
        </div>
    );
};

export default UsersDashboard