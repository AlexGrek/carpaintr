import { useState, useEffect } from "react";
import {
  Form,
  Button,
  Message,
  Input,
  InputGroup,
  Container,
  Panel,
} from "rsuite";
import { Eye, EyeOff } from "lucide-react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { resetCompanyInfo, authFetch, logout } from "../../utils/authFetch";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { useLocale, registerTranslations } from "../../localization/LocaleContext";
import "./LoginPage.css";

registerTranslations("ua", {
  "Unauthorized: Incorrect username or password.":
    "Невірна електронна адреса або пароль.",
  "Login failed. Please try again.":
    "Не вдалося увійти. Спробуйте ще раз.",
});

const LoginPage = () => {
  useDocumentTitle("Document title: Sign in");
  const { str } = useLocale();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  // Persistent inline error (key into translations). Toasts are too easy to
  // miss on mobile, so login feedback stays on screen until the next attempt.
  const [errorKey, setErrorKey] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Read ?redirect query parameter, default to /app/dashboard
  const params = new URLSearchParams(location.search);
  const redirect = params.get("redirect") || "/app/dashboard";

  // Check authentication on mount — show UI only after auth check settles
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
          if (resp.ok && !redirect.startsWith("/app/login")) {
            navigate(redirect, { replace: true });
          } else {
            setVisible(true);
          }
        }
      } catch {
        if (!cancelled) setVisible(true);
      }
    };
    checkAuth();
    return () => { cancelled = true; };
  }, [navigate, redirect]);

  const handleLogin = async () => {
    setLoading(true);
    setErrorKey(null);
    // The user is actively (re)authenticating, so drop any stale token first.
    // This prevents a half-authenticated state where a later mount/refresh
    // bounces to the dashboard and then back to login on the next 401.
    logout();
    try {
      const response = await fetch("/api/v1/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: username, password }),
      });

      if (response.status === 401 || response.status === 403) {
        setErrorKey("Unauthorized: Incorrect username or password.");
        return;
      }

      if (!response.ok) {
        setErrorKey("Login failed. Please try again.");
        return;
      }

      const data = await response.json();
      if (!data?.token) {
        setErrorKey("Login failed. Please try again.");
        return;
      }

      localStorage.setItem("authToken", data.token);
      resetCompanyInfo();
      navigate(redirect);
    } catch {
      setErrorKey("Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container className="auth-page" data-testid="login-page">
      <Panel className={`auth-panel${visible ? " auth-panel--visible" : ""}`} bordered>
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
        {errorKey && (
          <Message
            type="error"
            showIcon
            className="auth-error"
            data-testid="login-error"
          >
            {str(errorKey)}
          </Message>
        )}
        <Form fluid>
          <Form.Group>
            <Form.ControlLabel>Електронна адреса</Form.ControlLabel>
            <Input
              value={username}
              onChange={(value) => {
                setUsername(value);
                setErrorKey(null);
              }}
              data-testid="login-email-input"
            />
          </Form.Group>
          <Form.Group>
            <Form.ControlLabel>Пароль</Form.ControlLabel>
            <InputGroup inside>
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(value) => {
                  setPassword(value);
                  setErrorKey(null);
                }}
                data-testid="login-password-input"
              />
              <InputGroup.Button
                data-testid="login-password-toggle"
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </InputGroup.Button>
            </InputGroup>
          </Form.Group>
          <Form.Group>
            {" "}
            <Button
              appearance="primary"
              onClick={handleLogin}
              loading={loading}
              block
              data-testid="login-submit-button"
            >
              Увійти{" "}
            </Button>
          </Form.Group>{" "}
        </Form>
        {/* Footer links */}
        <div style={{ marginTop: "16pt", textAlign: "center" }}>
          <Link
            to="/app/register"
            style={{ marginRight: "20px" }}
            data-testid="login-register-link"
          >
            Реєстрація
          </Link>
          <Link to="/" data-testid="login-back-home-link">
            ← Назад на головну
          </Link>
        </div>
      </Panel>
    </Container>
  );
};

export default LoginPage;
