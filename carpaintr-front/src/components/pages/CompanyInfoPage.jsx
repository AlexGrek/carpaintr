import React, { useEffect, useState } from 'react';
import { authFetch } from '../../utils/authFetch';
import LicenseInfoTable from '../LicenseInfoTable';

const CompanyInfoPage = () => {
  const [companyInfo, setCompanyInfo] = useState(null);
  const [companyInfoRaw, setCompanyInfoRaw] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCompanyInfo = async () => {
      try {
        const response = await authFetch('/api/v1/getcompanyinfo');
        if (!response.ok) throw new Error('Failed to fetch company information');

        const data = await response.json();
        setCompanyInfo(data);
        setCompanyInfoRaw(JSON.stringify(data));
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchCompanyInfo();
  }, []);

  if (loading) {
    return <p>Loading...</p>;
  }

  return (
    <div>
      <LicenseInfoTable companyInfo={companyInfo} />
      <textarea value={companyInfoRaw}></textarea>
    </div>
  );
};

export default CompanyInfoPage;
