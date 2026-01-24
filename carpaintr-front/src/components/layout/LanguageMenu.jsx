import { useEffect, useState, useCallback } from "react";
import { Notification } from "rsuite";
import { SelectPicker } from "rsuite";
import {
  authFetch,
  getCompanyInfo,
  fetchCompanyInfo,
} from "../../utils/authFetch";
import {
  useLocale,
  registerTranslations,
} from "../../localization/LocaleContext";
import Trans from "../../localization/Trans";

registerTranslations("ua", {
  "App language": "Мова програми",
  "Output language": "Мова документів",
});

const LanguageMenu = () => {
  const [company, setCompany] = useState(null);
  const [message, setMessage] = useState(null);
  const { currentLang, setLang, str } = useLocale();

  useEffect(() => {
    if (getCompanyInfo() != null) {
      setCompany(getCompanyInfo());
      return;
    }

    const reportError = (err) => {
      console.error(err);
      setMessage({
        type: "error",
        title: str("Failed to get company info"),
        message: `${err}`,
      });
      setTimeout(() => setMessage(null), 3000);
    };

    const fetchAsync = async () => {
      const data = await fetchCompanyInfo(reportError);
      if (data) {
        setCompany(data);
        if (data.lang_ui) {
          setLang(data.lang_ui);
        }
      }
    };

    fetchAsync();
  }, [str, setLang]);

  const save = useCallback(async (value) => {
    const pushAsync = async () => {
      const data = await authFetch("/api/v1/updatecompanyinfo", {
        method: "POST",
        body: JSON.stringify(value),
        headers: {
          "Content-Type": "application/json",
        },
      });

      const newData = await fetchCompanyInfo();
      setCompany(newData);
    };

    await pushAsync();
  }, []);

  const handleSetLang = (lang) => {
    if (lang) {
      setLang(lang);
    }
    if (company && lang != company.lang_ui) {
      save({ ...company, lang_ui: lang });
    }
  };

  const data = [
    {
      label: "🇬🇧 English",
      value: "en",
    },
    {
      label: "🇺🇦 Українська",
      value: "ua",
    },
  ];
  return (
    <div>
      {message && (
        <Notification header={message.title}>{message.message}</Notification>
      )}
      <span>
        <Trans>App language</Trans>
      </span>
      <SelectPicker
        data={data}
        appearance="subtle"
        style={{ margin: "0 2pt" }}
        cleanable={false}
        searchable={false}
        onChange={handleSetLang}
        value={currentLang}
      />
      <br />
      <span>
        <Trans>Output language</Trans>
      </span>
      <SelectPicker
        disabled
        data={data}
        appearance="subtle"
        style={{ margin: "0 2pt" }}
        cleanable={false}
        searchable={false}
        onChange={handleSetLang}
        value={currentLang}
      />
      <br />
    </div>
  );
};

export default LanguageMenu;
