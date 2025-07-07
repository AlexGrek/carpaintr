import React from "react";
import "./LicenseBadge.css";

const licenseStyles = {
    Basic: "basic",
    "Basic Plus": "basic-plus",
    Premium: "premium",
    Unlimited: "unlimited",
};

export default function LicenseBadge({ licenseClass, expired, timeLeft }) {
    const className = licenseStyles[licenseClass] || "basic";
    const isExpired = expired || timeLeft <= 0;

    return (
        <div className={`badge ${className} ${isExpired ? "expired" : "active"}`}>
            <div className="badge-content">
                <div className="license-class">{licenseClass}</div>
                <div className="time-left">
                    {isExpired ? "Expired" : `${timeLeft.toFixed(1)} days left`}
                </div>
            </div>
            {!isExpired && <div className="shine" />}
        </div>
    );
} 
