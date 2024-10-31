import React, { useEffect, useState } from 'react';
import { Input, Message, Loader } from 'rsuite';
import { useNavigate } from 'react-router-dom';
import { authFetch } from '../../utils/authFetch';
import AdminTools from '../AdminTools';

const AdminPage = () => {
  const [adminStatus, setAdminStatus] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchAdminStatus = async () => {
      try {
        const response = await authFetch('/api/v1/admin/status');
        
        if (!response.ok) {
          throw new Error("You don't have access");
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
          <h3>Admin Status</h3>
          <Input
            componentClass="textarea"
            value={adminStatus}
            readOnly
            style={{ width: '100%', height: '400px' }}
          />
          <AdminTools />
        </>
      )}
    </div>
  );
};

export default AdminPage;
