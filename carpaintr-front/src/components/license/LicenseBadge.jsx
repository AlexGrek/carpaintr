import "./LicenseBadge.css";
import {
  useLocale,
  registerTranslations,
} from "../../localization/LocaleContext";

registerTranslations("ua", {
  Expired: "Термін дії завершився",
  "days left": "днів залишилось",
});

const licenseStyles = {
  Basic: "basic",
  "Basic Plus": "basic-plus",
  Premium: "premium",
  Unlimited: "unlimited",
};

export default function LicenseBadge({ licenseClass, expired, timeLeft }) {
  const className = licenseStyles[licenseClass] || "basic";
  const isExpired = expired || timeLeft <= 0;
  const { str } = useLocale();

  return (
    <div className={`badge ${className} ${isExpired ? "expired" : "active"}`}>
      <div className="badge-content">
        <div className="license-class">{licenseClass}</div>
        <div className="time-left">
          {isExpired ? str("Expired") : `${timeLeft} ${str("days left")}`}
        </div>
      </div>
      {!isExpired && <div className="shine" />}
    </div>
  );
}
