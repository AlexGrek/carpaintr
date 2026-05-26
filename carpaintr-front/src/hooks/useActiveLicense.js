import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { authFetch, handleAuthResponse } from "../utils/authFetch";

/**
 * Fetches GET /api/v1/getactivelicense for the current user.
 */
export function useActiveLicense() {
  const [licenseStatus, setLicenseStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;

    const fetchLicenses = async () => {
      try {
        const response = await authFetch("/api/v1/getactivelicense");
        if (
          response.status === 401 &&
          handleAuthResponse(response, navigate, location)
        ) {
          return;
        }
        if (!response.ok) {
          throw new Error(`Error: ${response.statusText}`);
        }
        const data = await response.json();
        if (!cancelled) {
          setLicenseStatus(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchLicenses();

    return () => {
      cancelled = true;
    };
  }, [navigate, location]);

  return { licenseStatus, loading, error };
}
