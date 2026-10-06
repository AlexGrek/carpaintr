import { authFetch } from './authFetch';

export async function mcpApi(path, { method = 'GET', body, binary = false } = {}) {
  const response = await authFetch(path, {
    method, ...(body !== undefined ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
  });
  if (response.status === 401) {
    const redirect = window.location.pathname + window.location.search;
    window.location.assign(`/app/login?redirect=${encodeURIComponent(redirect)}`);
    throw new Error('Sign in to continue');
  }
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `Request failed (${response.status})`);
  }
  return binary ? response.blob() : response.json();
}

export async function downloadSavedPdf(id, filename) {
  const blob = await mcpApi(`/api/v1/pdfs/${encodeURIComponent(id)}`, { binary: true });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
