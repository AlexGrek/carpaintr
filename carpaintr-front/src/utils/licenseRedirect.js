import { LICENSE_STATUS_PATH } from "../routes/paths";

export { LICENSE_STATUS_PATH };

export function isLicenseForbidden(response) {
  return response?.status === 403;
}

/** Navigate to the license status page (no active license / forbidden). */
export function redirectToLicenseStatus(navigate, { replace = true, state } = {}) {
  navigate(LICENSE_STATUS_PATH, { replace, state });
}

/**
 * If the response is 403 (license middleware), redirect and return true.
 * @returns {boolean} whether a redirect was performed
 */
export function handleLicenseForbidden(navigate, response, options) {
  if (isLicenseForbidden(response)) {
    redirectToLicenseStatus(navigate, options);
    return true;
  }
  return false;
}
