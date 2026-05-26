import { Suspense, lazy } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Loader, Message, Panel, Placeholder } from "rsuite";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import TopBarUser from "../layout/TopBarUser";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { useActiveLicense } from "../../hooks/useActiveLicense";
import {
  registerTranslations,
  useLocale,
} from "../../localization/LocaleContext";
import Trans from "../../localization/Trans";
import "./LicenseStatusPage.css";

const ClientLicenseListing = lazy(() => import("../ClientLicenseListing"));

registerTranslations("ua", {
  "Document title: License status": "Статус ліцензії",
  "License status": "Статус ліцензії",
  "Your license": "Ваша ліцензія",
  "Active license": "Ліцензія активна",
  "No active license": "Немає активної ліцензії",
  "License inactive description":
    "Для доступу до калькулятора, каталогу та інших функцій потрібна дійсна ліцензія. Зверніться до адміністратора або перевірте файли ліцензій нижче.",
  "License active description":
    "Ваша ліцензія дійсна. Нижче — деталі та всі файли ліцензій облікового запису.",
  Level: "Рівень",
  "Expires": "Діє до",
  "Days remaining": "Залишилось днів",
  "All license files": "Усі файли ліцензій",
  "Back to dashboard": "На головну",
  "Account settings": "Налаштування облікового запису",
  "Contact support": "Зв'язатися з підтримкою",
});

const listingFallback = (
  <div>
    <Placeholder.Paragraph rows={2} />
    <Loader backdrop vertical />
  </div>
);

const LicenseStatusPage = () => {
  const { str } = useLocale();
  const navigate = useNavigate();
  const { licenseStatus, loading, error } = useActiveLicense();

  useDocumentTitle("Document title: License status");

  const active = licenseStatus?.has_active_license === true;
  const license = licenseStatus?.license;

  return (
    <div className="license-status-page">
      <TopBarUser />
      <div className="license-status-body fade-in-simple">
        <header className="license-status-hero">
          <h1>{str("License status")}</h1>
          <p>{str("Your license")}</p>
        </header>

        {error && (
          <Message type="error" showIcon closable className="license-status-card">
            {error}
          </Message>
        )}

        {loading ? (
          <Loader center content={str("Loading...")} />
        ) : (
          <>
            <Panel
              className={`license-status-card ${active ? "license-status-card--active" : "license-status-card--inactive"}`}
              bordered
            >
              <div className="license-status-badge-row">
                {active ? (
                  <ShieldCheck size={40} color="#16a34a" aria-hidden />
                ) : (
                  <ShieldAlert size={40} color="#dc2626" aria-hidden />
                )}
              </div>
              <h2 style={{ textAlign: "center", margin: "0 0 0.75rem", fontSize: "1.15rem" }}>
                {active ? str("Active license") : str("No active license")}
              </h2>
              <p style={{ textAlign: "center", margin: "0 0 1rem", color: "#475569" }}>
                {active
                  ? str("License active description")
                  : str("License inactive description")}
              </p>
              {active && license && (
                <div className="license-status-detail">
                  <div>
                    <strong>{str("Level")}:</strong> {license.level}
                  </div>
                  <div>
                    <strong>{str("Expires")}:</strong> {license.expiration_date}
                  </div>
                  <div>
                    <strong>{str("Days remaining")}:</strong>{" "}
                    {Math.max(0, license.days_left + 1)}
                  </div>
                </div>
              )}
              <div className="license-status-actions">
                <Button appearance="primary" onClick={() => navigate("/app/dashboard")}>
                  <Trans>Back to dashboard</Trans>
                </Button>
                <Button appearance="default" onClick={() => navigate("/app/cabinet")}>
                  <Trans>Account settings</Trans>
                </Button>
                <Button
                  appearance="ghost"
                  onClick={() => navigate("/app/report?msg=License_support")}
                >
                  <Trans>Contact support</Trans>
                </Button>
              </div>
            </Panel>

            <Panel className="license-status-card license-status-licenses" bordered>
              <h2>{str("All license files")}</h2>
              <Suspense fallback={listingFallback}>
                <ClientLicenseListing />
              </Suspense>
            </Panel>
          </>
        )}
      </div>
    </div>
  );
};

export default LicenseStatusPage;
