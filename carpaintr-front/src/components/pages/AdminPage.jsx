import React, { useEffect, useState } from 'react';
import { Breadcrumb, Message, Loader, Text } from 'rsuite';
import { useNavigate } from 'react-router-dom';
import { authFetch } from '../../utils/authFetch';
import AdminTools from '../AdminTools';
import Trans from '../../localization/Trans';
import { useLocale, registerTranslations } from '../../localization/LocaleContext';
import AppVersionBadge from '../AppVersionBadge';

registerTranslations('ua', {
  "Admin Page": "Панель адміністратора",
  "Home": "Головна сторінка",
  "Dashboard": "Додатки"
});

const AdminPage = () => {
  const [adminStatus, setAdminStatus] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { str } = useLocale();

  useEffect(() => {
    const fetchAdminStatus = async () => {
      try {
        const response = await authFetch('/api/v1/admin/check_admin_status');

        if (!response.ok) {
          throw new Error(str("You don't have access"));
        }

        const data = await response.json();
        setAdminStatus(JSON.stringify(data, null, 2)); // Format JSON for display
      } catch (error) {
        setError(error.message);
        setTimeout(() => {
          navigate('/'); // Redirect to root after 5 seconds
        }, 5000);
      } finally {
        setLoading(false);
      }
    };

    fetchAdminStatus();
  }, [navigate]);

  if (loading) {
    return <Loader center content="Loading..." />;
  }

  return (
    <div style={{ padding: '20px' }}>
      {error ? (
        <Message type="error" showIcon>
          <h4>{error}</h4>
        </Message>
      ) : (
        <>
          <div className='police-line'></div>
          <h3><code><Trans>Admin Page</Trans></code></h3>
          <AppVersionBadge/>
          <Breadcrumb>
            <Breadcrumb.Item href="/"><Trans>Home</Trans></Breadcrumb.Item>
            <Breadcrumb.Item href="/dashboard"><Trans>Dashboard</Trans></Breadcrumb.Item>
            <Breadcrumb.Item active><Trans>Admin Page</Trans></Breadcrumb.Item>
          </Breadcrumb>
          <AdminTools className='fade-in-simple'/>
        </>
      )}
    </div>
  );
};

export default AdminPage;
