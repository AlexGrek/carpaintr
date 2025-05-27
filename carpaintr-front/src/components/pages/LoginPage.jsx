import React, { useState } from 'react';
import { Form, Button, Message, useToaster, Input, Container, Panel } from 'rsuite';
import { useNavigate } from 'react-router-dom';
import Trans from '../../localization/Trans';
import { useLocale } from '../../localization/LocaleContext';


const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const toaster = useToaster();
  const navigate = useNavigate();

  const handleLogin = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/v1/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: username, password: password })
      });

      if (response.status === 401 || response.status === 403) {
        throw new Error('Unauthorized: Incorrect username or password.');
      }

      if (!response.ok) throw new Error('Login failed. Please try again.');

      const data = await response.json();
      if (data.token) {
        localStorage.setItem('authToken', data.token); // Store the token in localStorage
        navigate('/');
      }
    } catch (error) {
      toaster.push(<Message type="error">{error.message}</Message>, { placement: 'topCenter' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container className='auth-page' >
      <Panel style={{ maxWidth: 400, margin: 'auto', padding: '2rem', marginTop: '8em', backgroundColor: 'white' }} bordered><Form fluid>
        <img src="/autolab_large_bw.png" alt="CarPaintr Logo" height="200pt" />
        <Form.Group>
          <Form.ControlLabel>Електронна адреса</Form.ControlLabel>
          <Input value={username} onChange={value => setUsername(value)} />
        </Form.Group>
        <Form.Group>
          <Form.ControlLabel>Пароль</Form.ControlLabel>
          <Input type="password" value={password} onChange={value => setPassword(value)} />
        </Form.Group>
        <Form.Group>
          <Button appearance="primary" onClick={handleLogin} loading={loading}>
            Увійти
          </Button>
        </Form.Group>
      </Form>
      </Panel>
    </Container>
  );
};

export default LoginPage;
