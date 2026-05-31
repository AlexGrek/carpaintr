import { useEffect, useState } from "react";
import { Loader } from "rsuite";
import { getOrFetchCompanyInfo } from "../../utils/authFetch";
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
    let cancelled = false;

    const fetchCompanyInfoNow = async () => {
      try {
        const data = await getOrFetchCompanyInfo();
        if (cancelled) return;
        setCompanyInfo(data);
        setCompanyInfoRaw(data ? dump(data) : "");
      } catch (error) {
        console.error(error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchCompanyInfoNow();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div data-testid="company-info-page">
        <Loader center content={str("Loading...")} />
      </div>
    );
  }

  return (
    <div
      data-testid="company-info-page"
      style={{ maxWidth: "800px", margin: "0 auto", padding: "1em" }}
    >
      <LicenseInfoTable companyInfo={companyInfo} />
      {companyInfoRaw ? <code>{companyInfoRaw}</code> : null}
    </div>
  );
};

export default CompanyInfoPage;
