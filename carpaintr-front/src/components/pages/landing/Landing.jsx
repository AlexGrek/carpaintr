import React, { useState, useEffect } from 'react';
import './styles.css';
import { Button, Message } from 'rsuite';
import { useNavigate } from 'react-router-dom';
import { authFetch, fetchCompanyInfo } from '../../../utils/authFetch';
import Trans from '../../../localization/Trans';
import { useLocale, registerTranslations } from '../../../localization/LocaleContext';

registerTranslations('ua', {
    "Features": "Можливості",
    "Benefits": "Переваги",
    "Contact": "Контакти",
    "Log In": "Увійти",
    "Join": "Приєднатися",
    "Automotive Business in Your Phone": "Автомобільний бізнес у вашому телефоні",
    "Accurate repair estimation, task tracking, and workflow management — everything you need to run your workshop on the go.": "Точні оцінки ремонту, відстеження завдань та управління процесами — все необхідне для вашої майстерні у телефоні.",
    "Request Evaluation": "Замовити оцінку",
    "Watch Demo": "Переглянути демо",
    "Logged in as": "Ви увійшли як",
    "Open dashboard": "Відкрити панель управління",
    "Accurate Repair Estimation & Workflow Management": "Точні оцінки та управління процесами",
    "Complete business management solution combining realistic pricing with smart task tracking": "Комплексне рішення для управління бізнесом, що поєднує реалістичні оцінки з розумним відстеженням завдань",
    "Accurate Repair Estimation": "Точні оцінки ремонту",
    "Use proven methods to calculate fair and transparent repair costs in minutes.": "Використовуйте перевірені методи для швидкого та прозорого розрахунку вартості ремонту.",
    "Task Tracking & Workflow": "Відстеження завдань та робочих процесів",
    "Follow each job from estimate to completion with clear progress tracking and notifications.": "Відстежуйте кожне завдання від кошторису до завершення з чітким контролем прогресу та сповіщеннями.",
    "Built-in Knowledge & Standards": "Вбудовані знання та стандарти",
    "Reference database of costs, labor times, and best practices to support your daily work.": "База витрат, трудовитрат та кращих практик для підтримки щоденної роботи.",
    "Boost Profitability & Streamline Operations": "Збільшіть прибутковість та оптимізуйте роботу",
    "Increase pricing accuracy with proven calculation methods": "Підвищуйте точність оцінок за допомогою перевірених методів",
    "Save 3+ hours daily with streamlined estimates and management": "Економте понад 3 години щодня завдяки швидким оцінкам і управлінню",
    "Win more jobs with transparent, consistent pricing": "Отримуйте більше замовлень завдяки прозорим і стабільним цінам",
    "Reduce task completion time with smart tracking": "Скорочуйте час виконання завдань завдяки зручному відстеженню",
    "Eliminate missed deadlines and pricing errors": "Позбавляйтесь прострочених термінів і помилок у кошторисах",
    "Scale operations with consistent standards and automation": "Масштабуйте роботу завдяки стандартам і автоматизації",
    "Ready to Transform Your Business?": "Готові змінити свій бізнес?",
    "Get Started Today": "Почніть сьогодні",
    "Schedule a Demo": "Заплануйте демо",
    "Product": "Продукт",
    "Demo": "Демо",
    "Integrations": "Інтеграції",
    "Updates": "Оновлення",
    "Support": "Підтримка",
    "Help Center": "Довідковий центр",
    "Contact Us": "Зв'язатися з нами",
    "Training": "Навчання",
    "API Docs": "Документація API",
    "Company": "Компанія",
    "About Us": "Про нас",
    "Careers": "Кар'єра",
    "Press": "Преса",
    "Partners": "Партнери",
    "All rights reserved. Built for auto body professionals.": "Всі права захищено. Створено для професіоналів авторемонту."
});

const Header = () => {
    return (
        <header className='landing'>
            <nav className="container landing">
                <div className="logo">autolab</div>
                <ul className="nav-links">
                    <li><a href="#features"><Trans>Features</Trans></a></li>
                    <li><a href="#benefits"><Trans>Benefits</Trans></a></li>
                    <li><a href="#contact"><Trans>Contact</Trans></a></li>
                </ul>
                <div>
                    <a href="/login" className="login-btn"><Trans>Log In</Trans></a>
                    <a href="/register" className="cta-btn"><Trans>Join</Trans></a>
                </div>
            </nav>
        </header>
    );
};

const Hero = () => {
    const [loading, setLoading] = useState(true);
    const [companyName, setCompanyName] = useState('');
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const { setLocale } = useLocale();
    const navigate = useNavigate();

    useEffect(() => {
        const doFetchCompanyInfo = async () => {
            try {
                const response = await fetchCompanyInfo();
                if (response.ok) {
                    const data = await response.json();
                    if (data["lang_ui"]) {
                        setLocale(data["lang_ui"])
                    }
                    setCompanyName(data.company_name);
                    setIsLoggedIn(true);
                }
            } catch (error) {
                console.error('Not logged in:', error);
            } finally {
                setLoading(false);
            }
        };

        doFetchCompanyInfo();
    }, []);

    return (
        <section className="hero">
            <div className="container">
                {isLoggedIn && <LoggedInMiniPanel companyName={companyName} />}
                {loading && <p>Loading...</p>}
                <div className="hero-content">
                    <h1><Trans>Automotive Business in Your Phone</Trans></h1>
                    <p><Trans>Accurate repair estimation, task tracking, and workflow management — everything you need to run your workshop on the go.</Trans></p>
                    <div className="hero-cta">
                        <a href="#demo" className="btn-primary"><Trans>Request Evaluation</Trans></a>
                        <a href="#demo" className="btn-secondary"><Trans>Watch Demo</Trans></a>
                    </div>
                </div>
            </div>
        </section>
    );
};

const LoggedInMiniPanel = ({ companyName }) => {
    const navigate = useNavigate();
    const { str } = useLocale();
    return <Message type="info">
        <p>{str("Logged in as")} {companyName}</p>
        <p><Button appearance='primary' color='green' onClick={() => navigate('/dashboard')}>{str("Open dashboard")}</Button></p>
    </Message>
}

const FeatureCard = ({ icon, title, description }) => {
    const { str } = useLocale();
    return (
        <div className="feature-card">
            <div className="feature-icon">{icon}</div>
            <h3>{str(title)}</h3>
            <p>{str(description)}</p>
        </div>
    );
};

const Features = () => {
    const { str } = useLocale();
    const features = [
        {
            icon: "📐",
            title: "Accurate Repair Estimation",
            description: "Use proven methods to calculate fair and transparent repair costs in minutes."
        },
        {
            icon: "📋",
            title: "Task Tracking & Workflow",
            description: "Follow each job from estimate to completion with clear progress tracking and notifications."
        },
        {
            icon: "📚",
            title: "Built-in Knowledge & Standards",
            description: "Reference database of costs, labor times, and best practices to support your daily work."
        }
    ];

    return (
        <section className="features" id="features">
            <div className="container">
                <div className="section-header">
                    <h2><Trans>Accurate Repair Estimation & Workflow Management</Trans></h2>
                    <p><Trans>Complete business management solution combining realistic pricing with smart task tracking</Trans></p>
                </div>
                <div className="features-grid">
                    {features.map((feature, index) => (
                        <FeatureCard
                            key={index}
                            icon={feature.icon}
                            title={feature.title}
                            description={feature.description}
                        />
                    ))}
                </div>
            </div>
        </section>
    );
};

const Benefits = () => {
    const { str } = useLocale();
    const benefits = [
        "Increase pricing accuracy with proven calculation methods",
        "Save 3+ hours daily with streamlined estimates and management",
        "Win more jobs with transparent, consistent pricing",
        "Reduce task completion time with smart tracking",
        "Eliminate missed deadlines and pricing errors",
        "Scale operations with consistent standards and automation"
    ];

    return (
        <section className="benefits" id="benefits">
            <div className="container">
                <div className="benefits-content">
                    <div className="benefits-text">
                        <h2><Trans>Boost Profitability & Streamline Operations</Trans></h2>
                        <ul className="benefit-list">
                            {benefits.map((benefit, index) => (
                                <li key={index}>{str(benefit)}</li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        </section>
    );
};

const FinalCTA = () => {
    return (
        <section className="final-cta">
            <div className="container">
                <h2><Trans>Ready to Transform Your Business?</Trans></h2>
                <div className="hero-cta">
                    <a href="#demo" className="btn-primary"><Trans>Get Started Today</Trans></a>
                    <a href="#contact" className="btn-secondary"><Trans>Schedule a Demo</Trans></a>
                </div>
            </div>
        </section>
    );
};

const Footer = () => {
    const { str } = useLocale();
    const footerSections = [
        {
            title: "Product",
            links: [
                { name: "Features", href: "#features" },
                { name: "Demo", href: "#demo" },
                { name: "Integrations", href: "#integrations" },
                { name: "Updates", href: "#updates" }
            ]
        },
        {
            title: "Support",
            links: [
                { name: "Help Center", href: "#help" },
                { name: "Contact Us", href: "#contact" },
                { name: "Training", href: "#training" },
                { name: "API Docs", href: "#api" }
            ]
        },
        {
            title: "Company",
            links: [
                { name: "About Us", href: "#about" },
                { name: "Careers", href: "#careers" },
                { name: "Press", href: "#press" },
                { name: "Partners", href: "#partners" }
            ]
        }
    ];

    return (
        <footer id="contact">
            <div className="container">
                <div className="footer-content">
                    {footerSections.map((section, index) => (
                        <div key={index} className="footer-section">
                            <h4>{str(section.title)}</h4>
                            {section.links.map((link, linkIndex) => (
                                <a key={linkIndex} href={link.href}>{str(link.name)}</a>
                            ))}
                        </div>
                    ))}
                </div>
                <div className="footer-bottom">
                    <p>&copy; 2025 AutoLab. <Trans>All rights reserved. Built for auto body professionals.</Trans></p>
                </div>
            </div>
        </footer>
    );
};

const AutoLabLanding = () => {
    useEffect(() => {
        // Smooth scrolling for navigation links
        const handleClick = (e) => {
            if (e.target.getAttribute('href')?.startsWith('#')) {
                e.preventDefault();
                const target = document.querySelector(e.target.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            }
        };

        document.addEventListener('click', handleClick);

        // Header background on scroll
        const handleScroll = () => {
            const header = document.querySelector('header');
            if (window.scrollY > 100) {
                header.style.background = 'rgba(255, 255, 255, 0.98)';
            } else {
                header.style.background = 'rgba(255, 255, 255, 0.95)';
            }
        };

        window.addEventListener('scroll', handleScroll);

        return () => {
            document.removeEventListener('click', handleClick);
            window.removeEventListener('scroll', handleScroll);
        };
    }, []);

    return (
        <div className="autolab-landing">
            <Header />
            <Hero />
            <Features />
            <Benefits />
            <FinalCTA />
            <Footer />
        </div>
    );
};

export default AutoLabLanding;
