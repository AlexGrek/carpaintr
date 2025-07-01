import { useEffect } from 'react';

export function useVersionCheck() {
  useEffect(() => {
    const currentVersion = __APP_VERSION__; // from vite.config.ts

    const checkForUpdate = async () => {
      try {
        const res = await fetch('/version.json', { cache: 'no-store' });
        const { appVersion: latestVersion } = await res.json();

        if (latestVersion !== currentVersion && latestVersion != undefined) {
          console.warn('New version detected:', latestVersion);
          window.location.reload(true); // force reload
        }
      } catch (err) {
        console.error('Version check failed:', err);
      }
    };

    // Check once on startup + every 30 seconds
    checkForUpdate();
    const interval = setInterval(checkForUpdate, 30000);
    return () => clearInterval(interval);
  }, []);
}
