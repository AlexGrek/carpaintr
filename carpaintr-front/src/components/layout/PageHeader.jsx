import { useLocale } from "../../localization/LocaleContext";

const pageHeaderStyle = {
  marginBottom: "1rem",
  fontSize: "1.5rem",
  fontWeight: 600,
  color: "var(--rs-text-heading, #0f0f0f)",
};

/**
 * Renders a translated page title (h1). Pass a translation key that exists in
 * LocaleContext (e.g. "Page header: Dashboard").
 */
const PageHeader = ({ titleKey, style = {} }) => {
  const { str } = useLocale();
  return (
    <h1 className="page-header" style={{ ...pageHeaderStyle, ...style }}>
      {str(titleKey)}
    </h1>
  );
};

export default PageHeader;
