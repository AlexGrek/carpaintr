import { useEffect, useState } from "react";
import { getCompanyInfo } from "../../utils/authFetch";
import LicenseInfoTable from "../LicenseInfoTable";
import PageHeader from "../layout/PageHeader";
import { dump } from "js-yaml";

const CompanyInfoPage = () => {
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
    return <p>Loading...</p>;
  }

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "1em" }}>
      <PageHeader titleKey="Page header: Company info" />
      <LicenseInfoTable companyInfo={companyInfo} />
      <code>{companyInfoRaw}</code>
    </div>
  );
};

export default CompanyInfoPage;
