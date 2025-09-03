import React, { useState } from 'react';
import { Form, Button, Message, useToaster, Input, Container, Panel } from 'rsuite';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { resetCompanyInfo } from '../../utils/authFetch';
import './LoginPage.css';

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const toaster = useToaster();
  const navigate = useNavigate();
  const location = useLocation();

  // Read ?redirect query parameter, default to /dashboard
  const params = new URLSearchParams(location.search);
  const redirect = params.get('redirect') || '/dashboard';

  const handleLogin = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/v1/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: username, password })
      });

      if (response.status === 401 || response.status === 403) {
        throw new Error('Unauthorized: Incorrect username or password.');
      }

      if (!response.ok) throw new Error('Login failed. Please try again.');

      const data = await response.json();
      if (data.token) {
        localStorage.setItem('authToken', data.token);
        resetCompanyInfo();
        navigate(redirect);
      }
    } catch (error) {
      toaster.push(<Message type="error">{error.message}</Message>, { placement: 'topCenter' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container className="auth-page">
      <Panel className="auth-panel fade-in-expand-simple" bordered>
        <img className="auth-logo" src="/autolab_large_bw.png" alt="CarPaintr Logo" />
        <Form fluid>
          <Form.Group>
            <Form.ControlLabel>Електронна адреса</Form.ControlLabel>
            <Input value={username} onChange={value => setUsername(value)} />
          </Form.Group>
          <Form.Group>
            <Form.ControlLabel>Пароль</Form.ControlLabel>
            <Input type="password" value={password} onChange={value => setPassword(value)} />
          </Form.Group>
          <Form.Group>
            <Button appearance="primary" onClick={handleLogin} loading={loading} block>
              Увійти
            </Button>
          </Form.Group>
        </Form>
        <Link style={{margin: '12pt', display: 'block'}} to='/register'>Реєстрація</Link>
      </Panel>
    </Container>
  );
};

export default LoginPage;
