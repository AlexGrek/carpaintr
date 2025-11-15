import React, { useEffect, useState } from "react";
import { Loader, Message, useToaster } from "rsuite";
import { authFetch, handleAuthResponse } from "../utils/authFetch";
import "./ActiveLicenseMarker.css";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { useLocale } from "../localization/LocaleContext";
import { useLocation, useNavigate } from "react-router-dom";

const ActiveLicenseMarker = () => {
  const [licenseStatus, setLicenseStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const toaster = useToaster();
  const { str } = useLocale();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const fetchLicenses = async () => {
      try {
        const response = await authFetch("/api/v1/getactivelicense");
        if (!handleAuthResponse(response, navigate, location)) {
          if (!response.ok) {
            throw new Error(`Error: ${response.statusText}`);
          }
          const data = await response.json();
          setLicenseStatus(data);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchLicenses();
  }, [location, navigate]);

  if (loading) {
    return (
      <div className="license-tag">
        <Loader />
      </div>
    );
  }

  if (error) {
    console.log(error);
    toaster.push(
      <Message type="error" closable>{`${str("Error")}: ${error}`}</Message>,
    );
  }

  if (licenseStatus == null) {
    return (
      <div className="license-tag">
        <ShieldAlert
          size={16}
          style={{
            display: "inline-block",
            marginRight: "4pt",
            transform: "translateY(-2px)",
          }}
        />
      </div>
    );
  }

  return (
    <div
      className="license-tag"
      color={licenseStatus["has_active_license"] ? "green" : "red"}
    >
      <ShieldCheck
        size={16}
        style={{
          display: "inline-block",
          marginRight: "4pt",
          transform: "translateY(-2px)",
        }}
      />
      {licenseStatus["has_active_license"]
        ? `Ліцензія активна (днів: ${licenseStatus.license.days_left + 1})`
        : "Ліцензія неактивна"}
    </div>
  );
};

export default ActiveLicenseMarker;
