import { useState, useEffect } from "react";
import {
  Form,
  Button,
  Message,
  useToaster,
  Input,
  InputGroup,
  Container,
  Panel,
} from "rsuite";
import { Eye, EyeOff } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { authFetch } from "../../utils/authFetch";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import "./LoginPage.css";

const RegistrationPage = () => {
  useDocumentTitle("Document title: Register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [invite, setInvite] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [visible, setVisible] = useState(false);
  const toaster = useToaster();
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    const checkAuth = async () => {
      const token = localStorage.getItem("authToken");
      if (!token) {
        if (!cancelled) setVisible(true);
        return;
      }
      try {
        const resp = await authFetch("/api/v1/getcompanyinfo");
        if (!cancelled) {
          if (resp.ok) {
            navigate("/app/dashboard", { replace: true });
          } else {
            setVisible(true);
          }
        }
      } catch {
        if (!cancelled) setVisible(true);
      }
    };
    checkAuth();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const handleRegistration = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/v1/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          invite,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || "Registration failed. Please try again.",
        );
      }

      toaster.push(
        <Message type="success">Реєстрація успішна! Тепер ви можете увійти.</Message>,
        { placement: "topCenter" },
      );
      navigate("/app/login");
    } catch (error) {
      toaster.push(<Message type="error">{error.message}</Message>, {
        placement: "topCenter",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container className="auth-page" data-testid="register-page">
      <Panel
        className={`auth-panel${visible ? " auth-panel--visible" : ""}`}
        bordered
      >
        <Link
          to="/"
          className="auth-logo-link"
          data-testid="auth-home-logo-link"
        >
          <img
            className="auth-logo fade-in-expand-simple"
            src="/autolab_large_bw.png"
            alt="CarPaintr Logo"
          />
        </Link>
        <Form fluid>
          <Form.Group>
            <Form.ControlLabel>Електронна адреса</Form.ControlLabel>
            <Input
              data-testid="register-email-input"
              value={email}
              onChange={setEmail}
            />
          </Form.Group>
          <Form.Group>
            <Form.ControlLabel>Пароль</Form.ControlLabel>
            <InputGroup inside>
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(value) => setPassword(value)}
                data-testid="register-password-input"
              />
              <InputGroup.Button
                data-testid="register-password-toggle"
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </InputGroup.Button>
            </InputGroup>
          </Form.Group>
          <Form.Group>
            <Form.ControlLabel>
              Код запрошення (необов&apos;язково)
            </Form.ControlLabel>
            <Input
              data-testid="register-invite-input"
              value={invite}
              onChange={setInvite}
            />
          </Form.Group>
          <Form.Group>
            <Button
              data-testid="register-submit-button"
              appearance="primary"
              onClick={handleRegistration}
              loading={loading}
              block
            >
              Зареєструватися
            </Button>
          </Form.Group>
        </Form>
        <div style={{ marginTop: "16pt", textAlign: "center" }}>
          <Link
            to="/app/login"
            style={{ marginRight: "20px" }}
            data-testid="register-login-link"
          >
            Увійти
          </Link>
          <Link to="/" data-testid="register-home-link">
            ← Назад на головну
          </Link>
        </div>
      </Panel>
    </Container>
  );
};

export default RegistrationPage;
