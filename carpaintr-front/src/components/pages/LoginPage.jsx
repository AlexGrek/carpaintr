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
import { useNavigate, useLocation, Link } from "react-router-dom";
import { resetCompanyInfo, authFetch } from "../../utils/authFetch";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import "./LoginPage.css";

const LoginPage = () => {
  useDocumentTitle("Document title: Sign in");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const toaster = useToaster();
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
    try {
      const response = await fetch("/api/v1/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: username, password }),
      });

      if (response.status === 401 || response.status === 403) {
        throw new Error("Unauthorized: Incorrect username or password.");
      }

      if (!response.ok) throw new Error("Login failed. Please try again.");

      const data = await response.json();
      if (data.token) {
        localStorage.setItem("authToken", data.token);
        resetCompanyInfo();
        navigate(redirect);
      }
    } catch (error) {
      toaster.push(<Message type="error">{error.message}</Message>, {
        placement: "topCenter",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container className="auth-page">
      <Panel className={`auth-panel${visible ? " auth-panel--visible" : ""}`} bordered>
        <img
          className="auth-logo fade-in-expand-simple"
          src="/autolab_large_bw.png"
          alt="CarPaintr Logo"
        />{" "}
        <Form fluid>
          <Form.Group>
            <Form.ControlLabel>Електронна адреса</Form.ControlLabel>
            <Input value={username} onChange={(value) => setUsername(value)} />
          </Form.Group>
          <Form.Group>
            <Form.ControlLabel>Пароль</Form.ControlLabel>
            <InputGroup inside>
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(value) => setPassword(value)}
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
            >
              Увійти{" "}
            </Button>
          </Form.Group>{" "}
        </Form>
        {/* Footer links */}
        <div style={{ marginTop: "16pt", textAlign: "center" }}>
          <Link to="/app/register" style={{ marginRight: "20px" }}>
            Реєстрація
          </Link>
          <Link to="/">← Назад на головну</Link>
        </div>
      </Panel>
    </Container>
  );
};

export default LoginPage;
