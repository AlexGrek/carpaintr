import { useEffect, useState } from "react";
import { Loader } from "rsuite";
import { getCompanyInfo } from "../../utils/authFetch";
import LicenseInfoTable from "../LicenseInfoTable";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { dump } from "js-yaml";
import { useLocale } from "../../localization/LocaleContext";

const CompanyInfoPage = () => {
  useDocumentTitle("Document title: Company info");
  const { str } = useLocale();
  const [companyInfo, setCompanyInfo] = useState(null);
  const [companyInfoRaw, setCompanyInfoRaw] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCompanyInfoNow = async () => {
      try {
        const data = getCompanyInfo();
        setCompanyInfo(data);
        setCompanyInfoRaw(dump(data));
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchCompanyInfoNow();
  }, []);

  if (loading) {
    return <Loader center content={str("Loading...")} />;
  }

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "1em" }}>
      <LicenseInfoTable companyInfo={companyInfo} />
      <code>{companyInfoRaw}</code>
    </div>
  );
};

export default CompanyInfoPage;
