import React, { useState } from 'react';
import { Form, Button, Message, useToaster, Input, Container, Panel } from 'rsuite';
import { useNavigate } from 'react-router-dom';

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

      if (response.status === 401) {
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
    <Container style={{ maxWidth: 400, margin: 'auto', padding: '2rem', marginTop: '8em' }}>
      <Panel bordered><Form fluid>
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
