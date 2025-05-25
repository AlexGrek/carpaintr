import React, { useState, useEffect } from 'react';
import './styles.css';
import { Button, Message } from 'rsuite';
import { useNavigate } from 'react-router-dom';
import { authFetch } from '../../../utils/authFetch';

const Header = () => {
    return (
        <header>
            <nav className="container">
                <div className="logo">AutoLab</div>
                <ul className="nav-links">
                    <li><a href="#features">Features</a></li>
                    <li><a href="#benefits">Benefits</a></li>
                    <li><a href="#contact">Contact</a></li>
                </ul>
                <div>
                    <a href="/login" className="login-btn">Log In</a>
                    <a href="/register" className="cta-btn">Join</a>
                </div>
            </nav>
        </header>
    );
};

const Hero = () => {
      const [loading, setLoading] = useState(true);
      const [companyName, setCompanyName] = useState('');
      const [isLoggedIn, setIsLoggedIn] = useState(false);
      const navigate = useNavigate();

    useEffect(() => {
        const fetchCompanyInfo = async () => {
          try {
            const response = await authFetch('/api/v1/getcompanyinfo');
            if (response.ok) {
              const data = await response.json();
              setCompanyName(data.company_name);
              setIsLoggedIn(true);
            }
          } catch (error) {
            console.error('Not logged in:', error);
          } finally {
            setLoading(false);
          }
        };
    
        fetchCompanyInfo();
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
                    <h1>Smart Pricing & Task Management for Auto Body Shops</h1>
                    <p>AI-powered pricing calculator with advanced task tracking. Calculate accurate estimates instantly while managing your entire workflow efficiently from estimate to completion.</p>
                    <div className="hero-cta">
                        <a href="#demo" className="btn-primary">Request Evaluation</a>
                        <a href="#demo" className="btn-secondary">Watch Demo</a>
                    </div>
                </div>
            </div>
        </section>
    );
};

const LoggedInMiniPanel = ({companyName}) => {
    const navigate = useNavigate();
    return <Message type="info">
        <p>Logged in as {companyName}</p>
        <p><Button appearance='primary' color='green' onClick={() => navigate('/dashboard')}>Open dashboard</Button></p>
    </Message>
}

const FeatureCard = ({ icon, title, description }) => {
    return (
        <div className="feature-card">
            <div className="feature-icon">{icon}</div>
            <h3>{title}</h3>
            <p>{description}</p>
        </div>
    );
};

const Features = () => {
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
                    <h2>Precision Pricing & Smart Task Management</h2>
                    <p>Complete business management solution combining AI-powered pricing with intelligent task tracking</p>
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
                        <h2>Boost Profitability & Streamline Operations</h2>
                        <ul className="benefit-list">
                            {benefits.map((benefit, index) => (
                                <li key={index}>{benefit}</li>
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
                        <p><strong>Accurate pricing & real-time tracking</strong> in one comprehensive solution</p>
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
                <h2>Ready to Transform Your Business?</h2>
                <p>Join 500+ auto body shops already using AutoLab for intelligent pricing and efficient task management</p>
                <div className="hero-cta">
                    <a href="#demo" className="btn-primary">Request Evaluation License</a>
                    <a href="#contact" className="btn-secondary">Schedule Demo</a>
                </div>
            </div>
        </section>
    );
};

const Footer = () => {
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
                            <h4>{section.title}</h4>
                            {section.links.map((link, linkIndex) => (
                                <a key={linkIndex} href={link.href}>{link.name}</a>
                            ))}
                        </div>
                    ))}
                </div>
                <div className="footer-bottom">
                    <p>&copy; 2025 AutoLab. All rights reserved. Built for auto body professionals.</p>
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