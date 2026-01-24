import { useLocale } from "../localization/LocaleContext";

const Trans = ({ children }) => {
  const { str } = useLocale();

  const translation = str(children);

  return <>{translation}</>;
};

export default Trans;
