import { useCallback } from "react";
import { Loader } from "rsuite";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  useLocale,
  registerTranslations,
} from "../localization/LocaleContext";
import Trans from "../localization/Trans";
import { useActiveLicense } from "../hooks/useActiveLicense";
import { LICENSE_STATUS_PATH } from "../routes/paths";
import "./ActiveLicenseMarker.css";

registerTranslations("ua", {
  "License status": "Статус ліцензії",
});

const ActiveLicenseMarker = () => {
  const { licenseStatus, loading, error } = useActiveLicense();
  const { str } = useLocale();
  const navigate = useNavigate();

  const goToLicenseStatus = useCallback(() => {
    navigate(LICENSE_STATUS_PATH);
  }, [navigate]);

  if (loading) {
    return (
      <div className="license-tag">
        <Loader />
      </div>
    );
  }

  if (error) {
    console.error(error);
  }

  if (licenseStatus == null) {
    return (
      <button
        type="button"
        className="license-tag license-tag--clickable"
        onClick={goToLicenseStatus}
        data-testid="license-status-marker"
        aria-label={str("License status")}
      >
        <ShieldAlert
          size={16}
          style={{
            display: "inline-block",
            marginRight: "4pt",
            transform: "translateY(-2px)",
          }}
        />
        <Trans>License status</Trans>
      </button>
    );
  }

  const active =
    licenseStatus.has_active_license && licenseStatus.license != null;
  const label =
    active && licenseStatus.license
      ? `Ліцензія активна (днів: ${licenseStatus.license.days_left + 1})`
      : "Ліцензія неактивна";

  return (
    <button
      type="button"
      className={`license-tag license-tag--clickable ${active ? "license-tag--active" : "license-tag--inactive"}`}
      onClick={goToLicenseStatus}
      data-testid="license-status-marker"
      aria-label={str("License status")}
    >
      {active ? (
        <ShieldCheck
          size={16}
          style={{
            display: "inline-block",
            marginRight: "4pt",
            transform: "translateY(-2px)",
          }}
        />
      ) : (
        <ShieldAlert
          size={16}
          style={{
            display: "inline-block",
            marginRight: "4pt",
            transform: "translateY(-2px)",
          }}
        />
      )}
      {label}
    </button>
  );
};

export default ActiveLicenseMarker;
