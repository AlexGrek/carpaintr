// UsersDashboard.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Text, Message } from "rsuite";
import ActiveLicenseMarker from "../ActiveLicenseMarker";
import Trans from "../../localization/Trans";
import {
  useLocale,
  registerTranslations,
} from "../../localization/LocaleContext";
import { authFetch, fetchCompanyInfo } from "../../utils/authFetch";
import "./UsersDashboard.css";
import {
  Biohazard,
  BrainCircuit,
  Cog,
  DraftingCompass,
  FileCheck,
  FileCode,
  FileText,
  Grid2X2,
  Grip,
  LayoutGrid,
  Rows3,
  ScanBarcode,
} from "lucide-react";
import AppVersionBadge from "../AppVersionBadge";
import TopBarDashboard from "../layout/TopBarDashboard";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";

registerTranslations("ua", {
  Calculation: "Розрахунок",
  "Price estimation calculator": "Калькулятор оцінки вартості",
  "Task Tracking": "Відстеження завдань",
  "Under construction": "У розробці",
  "AI Analytics": "Аналітика ШІ",
  Catalog: "Каталог",
  "All data": "Доступні дані",
  Customization: "Персоналізація",
  "Customize everything": "Глибокі налаштування",
  "Your organization": "Ваша організація",
  "Manage access and licensing": "Керування доступом та ліцензуванням",
  "Available apps": "Доступні програми",
  "Your company": "Ваша компанiя",
  "As list": "У вигляді списку",
  "As grid": "У вигляді сітки", // New translation
  "As blocks": "У вигляді блоків", // New translation
  "Admin Area": "Адміністрування",
  Templates: "Шаблони документів",
  "Customize templates": "Налаштування вигляду документів",
});

const UsersDashboard = () => {
  return (
    <div className="users-dashboard-page">
      <TopBarDashboard />
      <div className="users-dashboard-body">
        <Dashboard />
      </div>
    </div>
  );
};

const ShowCompanyCard = ({ company }) => {
  const { str } = useLocale();
  return (
    <div className="dashboard-company-card fade-in-simple">
      <div className="dashboard-company-card-inner">
        <span className="dashboard-company-card-label">{str("Your company")}</span>
        <h2 className="dashboard-company-card-name">
          {company && company.company_name}
        </h2>
        <Text className="dashboard-company-card-email" muted>
          {company && company.email}
        </Text>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const [company, setCompany] = useState(null);
  const [message, setMessage] = useState(null);
  const { str, setLang } = useLocale();
  const [admin, setAdmin] = useState(false);
  useDocumentTitle("Document title: Dashboard");

  useEffect(() => {
    const fetchAdminStatus = async () => {
      try {
        const response = await authFetch("/api/v1/admin/check_admin_status");
        if (response.ok) {
          let data = await response.json();
          if (data.is_admin) {
            setAdmin(true);
          }
        }
      } catch {
        setAdmin(false);
      }
    };
    fetchAdminStatus();
  }, []);

  useEffect(() => {
    const reportError = (err) => {
      console.error(err);
      setMessage({
        type: "error",
        title: str("Failed to get company info"),
        message: `${err}`,
      });
      setTimeout(() => setMessage(null), 3000);
    };

    const fetchAsync = async () => {
      const data = await fetchCompanyInfo(reportError);
      if (data) {
        setCompany(data);
        if (data.lang_ui) {
          setLang(data.lang_ui);
        }
      }
    };

    fetchAsync();
  }, [str, setLang]);

  return (
    <div>
      <div className="gradient-box">
        {message && (
          <Message showIcon type={message.type} header={message.title}>
            {message.message}
          </Message>
        )}
        <ActiveLicenseMarker />
        {company && <ShowCompanyCard company={company}></ShowCompanyCard>}
      </div>
      <main className="dashboard-content-container">
        <DashboardNavigationButtons admin={admin} />
        <AppVersionBadge />
      </main>
    </div>
  );
};

const DashboardNavigationButtons = ({ admin }) => {
  const { str } = useLocale();
  const [viewMode, setViewMode] = useState(
    () => localStorage.getItem("appViewMode") || "list",
  );

  useEffect(() => {
    localStorage.setItem("appViewMode", viewMode);
  }, [viewMode]);

  const features = [
    {
      icon: <DraftingCompass />,
      title: str("Calculation"),
      description: str("Price estimation calculator"),
      link: "/app/calc2",
    },
    {
      icon: <FileCode />,
      title: str("Customization"),
      description: str("Customize everything"),
      link: "/app/fileeditor",
    },
    {
      icon: <ScanBarcode />,
      title: str("Catalog"),
      description: str("All data"),
      link: "/app/catalog",
    },
    {
      icon: <FileText />,
      title: str("Templates"),
      description: str("Customize templates"),
      link: "/app/templates",
    },
    {
      icon: <Cog />,
      title: str("Your organization"),
      description: str("Manage access and licensing"),
      link: "/app/cabinet",
    },
    {
      icon: <FileCheck />,
      title: str("Task Tracking"),
      description: "🚧 " + str("Under construction") + " 🚧",
      link: "/app/wip",
    },
    {
      icon: <BrainCircuit />,
      title: str("AI Analytics"),
      description: "🚧 " + str("Under construction") + " 🚧",
      link: "/app/wip",
    },
    {
      icon: <Biohazard />,
      title: str("Admin Area"),
      description: "Control everything",
      link: "/app/admin",
      hidden: !admin,
    },
  ];

  return (
    <section className="apps-list slide-in-simple">
      <div className="apps-list-container">
        <div className="apps-list-section-header">
          <h2 className="apps-list-title">
            <LayoutGrid size={22} className="apps-list-title-icon" />
            <Trans>Available apps</Trans>
          </h2>
          <div className="apps-view-toggle" role="tablist" aria-label="View mode">
            {[
              { key: "list", icon: Rows3, label: str("As list") },
              { key: "grid", icon: Grip, label: str("As grid") },
              { key: "blocks", icon: Grid2X2, label: str("As blocks") },
            ].map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={viewMode === key}
                aria-label={label}
                className={`apps-view-toggle-btn ${viewMode === key ? "active" : ""}`}
                onClick={() => setViewMode(key)}
              >
                <Icon size={16} aria-hidden />
                <span className="apps-view-toggle-btn-label">{label}</span>
              </button>
            ))}
          </div>
        </div>
        <div className={`features-grid ${viewMode}-view`}>
          {features.map((feature, index) => {
            if (viewMode === "grid") {
              return (
                <AppCardCompact
                  key={index}
                  icon={feature.icon}
                  title={feature.title}
                  link={feature.link}
                  isHidden={feature.hidden || false}
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
                  isHidden={feature.hidden || false}
                />
              );
            }
          })}
        </div>
      </div>
    </section>
  );
};

const AppCard = ({ icon, title, description, link, isHidden }) => {
  const nav = useNavigate();
  if (isHidden) {
    return <></>;
  }
  return (
    <div
      className="app-card"
      style={{ cursor: "pointer" }}
      onClick={() => nav(link)}
    >
      <div className="app-feature-icon">{icon}</div>
      <div>
        <h3>{title}</h3>
        <p className="app-description">{description}</p>
      </div>
    </div>
  );
};

const AppCardCompact = ({ icon, title, link, isHidden }) => {
  const nav = useNavigate();
  if (isHidden) {
    return <></>;
  }
  return (
    <div
      className="app-card compact-app-card"
      style={{ cursor: "pointer" }}
      onClick={() => nav(link)}
    >
      <div className="app-feature-icon">{icon}</div>
      <h3>{title}</h3>
    </div>
  );
};

export default UsersDashboard;
