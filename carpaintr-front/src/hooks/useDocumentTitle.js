import { useEffect } from "react";
import { useLocale } from "../localization/LocaleContext";

const APP_NAME = "autolab";

/**
 * Sets document title (browser tab) to the translated string for the given key.
 * Use translation keys like "Document title: Dashboard" (see LocaleContext).
 */
export function useDocumentTitle(titleKey) {
  const { str, currentLang } = useLocale();

  useEffect(() => {
    const base = titleKey ? str(titleKey) : APP_NAME;
    document.title = base ? `${base} | ${APP_NAME}` : APP_NAME;
    return () => {
      document.title = APP_NAME;
    };
  }, [titleKey, currentLang]);
}
