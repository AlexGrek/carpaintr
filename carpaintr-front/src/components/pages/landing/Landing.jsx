import React, { useState, useEffect } from 'react';
import './styles.css';
import { Button, Message } from 'rsuite';
import { useNavigate } from 'react-router-dom';
import { authFetch, fetchCompanyInfo } from '../../../utils/authFetch';
import Trans from '../../../localization/Trans';
import { useLocale, registerTranslations } from '../../../localization/LocaleContext';

registerTranslations('ua', {
    "Features": "Можливості",
    "Benefits": "Вигода",
    "Contact": "Контакти",
    "Log In": "Увійти",
    "Join": "Приєднатися",
    "Smart Pricing & Task Management for Auto Body Shops": "Розумне ціноутворення та управління завданнями для автомайстерень",
    "AI-powered pricing calculator with advanced task tracking. Calculate accurate estimates instantly while managing your entire workflow efficiently from estimate to completion.": "Калькулятор цін на базі штучного інтелекту з розширеним відстеженням завдань. Миттєво розраховуйте точні кошториси, ефективно керуючи всім робочим процесом від оцінки до завершення.",
    "Request Evaluation": "Замовити оцінку",
    "Watch Demo": "Дивитись демо",
    "Logged in as": "Ви увійшли як",
    "Open dashboard": "Відкрити панель управління",
    "Precision Pricing & Smart Task Management": "Точне ціноутворення та розумне управління завданнями",
    "Complete business management solution combining AI-powered pricing with intelligent task tracking": "Комплексне рішення для управління бізнесом, що поєднує ціноутворення на базі ШІ з інтелектуальним відстеженням завдань",
    "AI-Powered Pricing": "Ціноутворення на базі ШІ",
    "Advanced algorithms analyze vehicle type, damage extent, paint requirements, and labor complexity to deliver precise pricing estimates in seconds.": "Передові алгоритми аналізують тип транспортного засобу, ступінь пошкодження, вимоги до фарбування та складність робіт, щоб надати точні кошториси за лічені секунди.",
    "Smart Task Tracking": "Розумне відстеження завдань",
    "Track every paint job from estimate to completion. Real-time progress monitoring, automated notifications, and intelligent workflow management.": "Відстежуйте кожну роботу з фарбування від кошторису до завершення. Моніторинг прогресу в реальному часі, автоматичні сповіщення та інтелектуальне управління робочим процесом.",
    "AI Suggestions & Knowledge Base": "Пропозиції ШІ та база знань",
    "Get intelligent recommendations for materials, techniques, and scheduling. Built-in database of costs, labor rates, and industry standards.": "Отримуйте інтелектуальні рекомендації щодо матеріалів, технік та планування. Вбудована база даних витрат, розцінок на роботу та галузевих стандартів.",
    "Boost Profitability & Streamline Operations": "Збільште прибутковість та оптимізуйте операції",
    "Increase pricing accuracy by 95% with AI-driven calculations": "Збільште точність ціноутворення на 95% за допомогою розрахунків на основі ШІ",
    "Save 3+ hours daily on estimates and task management": "Економте 3+ години щодня на кошторисах та управлінні завданнями",
    "Win 40% more jobs with competitive, precise pricing": "Вигравайте на 40% більше замовлень завдяки конкурентоспроможним, точним цінам",
    "Reduce task completion time by 45% with smart tracking": "Скоротіть час виконання завдань на 45% завдяки розумному відстеженню",
    "Eliminate missed deadlines and pricing errors": "Усуньте пропущені терміни та помилки в ціноутворенні",
    "Scale operations with consistent standards and automation": "Масштабуйте операції за допомогою єдиних стандартів та автоматизації",
    "Accurate pricing & real-time tracking": "Точне ціноутворення та відстеження в реальному часі",
    "in one comprehensive solution": "в одному комплексному рішенні",
    "Ready to Transform Your Business?": "Готові трансформувати свій бізнес?",
    "Join 500+ auto body shops already using AutoLab for intelligent pricing and efficient task management": "Приєднуйтесь до 500+ автомайстерень, які вже використовують AutoLab для інтелектуального ціноутворення та ефективного управління завданнями",
    "Request Evaluation License": "Запит на оціночну ліцензію",
    "Schedule Demo": "Запланувати демонстрацію",
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
        <header>
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
                console.log("Setting locale based on company info: " + data["lang_ui"])
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

      const handleLogout = () => {
        localStorage.removeItem('authToken'); // Remove the token
        setIsLoggedIn(false);
        navigate('/');
      };
    return (
        <section className="hero">
            <div className="container">
                {isLoggedIn && <LoggedInMiniPanel companyName={companyName}/>}
                {loading && <p>Loading...</p>}
                <div className="hero-content">
                    <h1><Trans>Smart Pricing & Task Management for Auto Body Shops</Trans></h1>
                    <p><Trans>AI-powered pricing calculator with advanced task tracking. Calculate accurate estimates instantly while managing your entire workflow efficiently from estimate to completion.</Trans></p>
                    <div className="hero-cta">
                        <a href="#demo" className="btn-primary"><Trans>Request Evaluation</Trans></a>
                        <a href="#demo" className="btn-secondary"><Trans>Watch Demo</Trans></a>
                    </div>
                </div>
            </div>
        </section>
    );
};

const LoggedInMiniPanel = ({companyName}) => {
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
            icon: "🎯",
            title: "AI-Powered Pricing",
            description: "Advanced algorithms analyze vehicle type, damage extent, paint requirements, and labor complexity to deliver precise pricing estimates in seconds."
        },
        {
            icon: "📋",
            title: "Smart Task Tracking",
            description: "Track every paint job from estimate to completion. Real-time progress monitoring, automated notifications, and intelligent workflow management."
        },
        {
            icon: "🤖",
            title: "AI Suggestions & Knowledge Base",
            description: "Get intelligent recommendations for materials, techniques, and scheduling. Built-in database of costs, labor rates, and industry standards."
        }
    ];

    return (
        <section className="features" id="features">
            <div className="container">
                <div className="section-header">
                    <h2><Trans>Precision Pricing & Smart Task Management</Trans></h2>
                    <p><Trans>Complete business management solution combining AI-powered pricing with intelligent task tracking</Trans></p>
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
        "Increase pricing accuracy by 95% with AI-driven calculations",
        "Save 3+ hours daily on estimates and task management",
        "Win 40% more jobs with competitive, precise pricing",
        "Reduce task completion time by 45% with smart tracking",
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
                    <div className="benefits-visual">
                        <div className="pricing-demo">
                            <div className="demo-title">2018 Honda Civic - Full Panel Repair</div>
                            <div className="demo-price">$1,247</div>
                            <div className="demo-details">
                                Materials: $423 • Labor: $680 • Overhead: $144<br />
                                Status: 85% Complete • Next: Clear coat
                            </div>
                        </div>
                        <p><strong><Trans>Accurate pricing & real-time tracking</Trans></strong> <Trans>in one comprehensive solution</Trans></p>
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
                <p><Trans>Join 500+ auto body shops already using AutoLab for intelligent pricing and efficient task management</Trans></p>
                <div className="hero-cta">
                    <a href="#demo" className="btn-primary"><Trans>Request Evaluation License</Trans></a>
                    <a href="#contact" className="btn-secondary"><Trans>Schedule Demo</Trans></a>
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

        // Animate elements on scroll
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }
            });
        }, observerOptions);

        // Observe feature cards for animation
        document.querySelectorAll('.feature-card').forEach(card => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(30px)';
            card.style.transition = 'all 0.6s ease';
            observer.observe(card);
        });

        return () => {
            document.removeEventListener('click', handleClick);
            window.removeEventListener('scroll', handleScroll);
            observer.disconnect();
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