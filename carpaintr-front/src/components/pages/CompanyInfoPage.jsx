import React, { useEffect, useState } from 'react';
import { authFetch, getCompanyInfo } from '../../utils/authFetch';
import LicenseInfoTable from '../LicenseInfoTable';
 import { dump } from 'js-yaml';

const CompanyInfoPage = () => {
  const [companyInfo, setCompanyInfo] = useState(null);
  const [companyInfoRaw, setCompanyInfoRaw] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCompanyInfoNow = async () => {
      try {
        const data = await fetchCompanyInfo();
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
    <div>
      <LicenseInfoTable companyInfo={companyInfo} />
      <code>{companyInfoRaw}</code>
    </div>
  );
};

export default CompanyInfoPage;
