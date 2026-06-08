import { SelectPicker } from "rsuite";
import { useLocale } from "../../localization/LocaleContext";

const LocaleSwitch = () => {
  const { currentLang, setLang } = useLocale();

  const data = [
    {
      label: "🇬🇧 English",
      value: "en",
    },
    {
      label: "🇺🇦 Державна",
      value: "ua",
    },
  ];

  const handleSetLang = (lang) => {
    if (lang) {
      setLang(lang);
    }
  };

  return (
    <SelectPicker
      data={data}
      appearance="subtle"
      style={{ margin: "0 2pt" }}
      cleanable={false}
      searchable={false}
      onChange={handleSetLang}
      value={currentLang}
    />
  );
};

export default LocaleSwitch;
