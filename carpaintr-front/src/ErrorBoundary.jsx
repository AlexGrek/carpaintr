// ErrorBoundary.jsx
import React from "react";
import ErrorMessage from "./components/layout/ErrorMessage";
import { authFetch } from "./utils/authFetch";
import {
  Breadcrumb,
  Button,
  ButtonGroup,
  Panel,
} from "rsuite";
import { BugOff, Globe, Home, RefreshCw, ShieldX } from "lucide-react";
import AppVersionBadge from "./components/AppVersionBadge";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);

    const currentVersion = __APP_VERSION__;

    const report = {
      component: errorInfo?.componentStack || "",
      message: error?.toString() || "",
      appVersion: currentVersion || "",
    };

    authFetch("/api/v1/report_frontend_failure", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(report),
    }).catch((err) => {
      console.error("Failed to report frontend failure:", err);
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            margin: "0",
            backgroundColor: "#fde2e2",
            padding: "20px",
          }}
        >
          <Panel
            shaded
            style={{
              maxWidth: "747px",
              margin: "auto",
              padding: "12pt",
              backgroundColor: "#f5f5f5",
            }}
          >
            <ErrorMessage
              errorTitle="Critical failure"
              errorText={this.state.error?.toString()}
            />
            <p className="fade-in-simple" style={{ marginTop: "42px" }}>
              <ButtonGroup>
                <Button appearance="ghost" onClick={() => location.reload()}>
                  <RefreshCw /> Refresh Page
                </Button>
                <Button appearance="primary" onClick={() => location.reload()}>
                  <RefreshCw /> Оновити сторінку
                </Button>
              </ButtonGroup>
            </p>
            <p>
              🇬🇧 Our team is already notified about this failure.{" "}
              <a href="/app/report?msg=Frontend_error">Report error</a> manually.
            </p>
            <p>
              🇺🇦 Наша команда вже поінформована про проблему.{" "}
              <a href="/app/report?msg=Помилка_відображення">
                Повідомити про помилку
              </a>{" "}
              власноруч.
            </p>
            <p />
            <Breadcrumb style={{ margin: "auto" }}>
              <Breadcrumb.Item href="/">
                <Globe />
              </Breadcrumb.Item>
              <Breadcrumb.Item href="/app/report?msg=Frontend_error">
                <BugOff />
              </Breadcrumb.Item>
              <Breadcrumb.Item href="/app/dashboard">
                <Home />
              </Breadcrumb.Item>
              <Breadcrumb.Item active>
                <ShieldX />
              </Breadcrumb.Item>
            </Breadcrumb>
            <p />
            <AppVersionBadge />
          </Panel>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
