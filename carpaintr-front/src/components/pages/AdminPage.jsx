import { useEffect, useState } from "react";
import {
  Breadcrumb,
  Button,
  Loader,
  Message,
  Panel,
  Stack,
  Tag,
} from "rsuite";
import { Link, useNavigate } from "react-router-dom";
import { authFetch } from "../../utils/authFetch";
import AdminTools from "../AdminTools";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import Trans from "../../localization/Trans";
import {
  useLocale,
  registerTranslations,
} from "../../localization/LocaleContext";
import AppVersionBadge from "../AppVersionBadge";

registerTranslations("ua", {
  "Admin Page": "Панель адміністратора",
  Home: "Головна сторінка",
  Dashboard: "Додатки",
  "Admin control center": "Центр керування адміністратора",
  "Secure access confirmed": "Безпечний доступ підтверджено",
  "Control users, licenses, files and support requests from one workspace.":
    "Керуйте користувачами, ліцензіями, файлами та запитами підтримки з одного місця.",
  "Quick actions": "Швидкі дії",
  "Manage users": "Керування користувачами",
  "Support requests": "Запити підтримки",
  "Admin workspace": "Робочий простір адміністратора",
  "Open tools and manage backend operations.":
    "Відкрийте інструменти та керуйте операціями бекенда.",
});

const AdminPage = () => {
  const [adminStatus, setAdminStatus] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { str } = useLocale();
  useDocumentTitle("Document title: Admin Area");

  useEffect(() => {
    const fetchAdminStatus = async () => {
      try {
        const response = await authFetch("/api/v1/admin/check_admin_status");

        if (!response.ok) {
          throw new Error(str("You don't have access"));
        }

        const data = await response.json();
        setAdminStatus(data);
      } catch (error) {
        setError(error.message);
        setTimeout(() => {
          navigate("/");
        }, 5000);
      } finally {
        setLoading(false);
      }
    };

    fetchAdminStatus();
  }, [navigate, str]);

  if (loading) {
    return (
      <div style={{ minHeight: "50vh", display: "grid", placeItems: "center" }}>
        <Loader size="lg" content={str("Loading...")} />
      </div>
    );
  }

  return (
    <div style={{ padding: "20px 16px 40px" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", display: "grid", gap: 16 }}>
        <Panel bordered shaded>
          <Stack
            justifyContent="space-between"
            alignItems="flex-start"
            wrap
            spacing={12}
            style={{ marginBottom: 12 }}
          >
            <div>
              <h2 style={{ margin: "0 0 6px 0" }}>
                <Trans>Admin control center</Trans>
              </h2>
              <p style={{ margin: 0, opacity: 0.75 }}>
                <Trans>
                  Control users, licenses, files and support requests from one workspace.
                </Trans>
              </p>
            </div>
            <Stack spacing={8} wrap>
              <Tag color={error ? "red" : "green"}>
                {error ? error : str("Secure access confirmed")}
              </Tag>
              <AppVersionBadge />
            </Stack>
          </Stack>

          <Breadcrumb>
            <Breadcrumb.Item as={Link} to="/">
              <Trans>Home</Trans>
            </Breadcrumb.Item>
            <Breadcrumb.Item as={Link} to="/app/dashboard">
              <Trans>Dashboard</Trans>
            </Breadcrumb.Item>
            <Breadcrumb.Item active>
              <Trans>Admin Page</Trans>
            </Breadcrumb.Item>
          </Breadcrumb>
        </Panel>

        {error ? (
          <Message type="error" showIcon>
            <h4>{error}</h4>
          </Message>
        ) : (
          <>
            <Panel bordered>
              <Stack justifyContent="space-between" wrap spacing={10}>
                <strong>
                  <Trans>Quick actions</Trans>
                </strong>
                <Stack spacing={8} wrap>
                  <Button
                    appearance="primary"
                    as={Link}
                    to="manage-users"
                    data-testid="admin-quick-manage-users"
                  >
                    <Trans>Manage users</Trans>
                  </Button>
                  <Button
                    appearance="ghost"
                    as={Link}
                    to="requests"
                    data-testid="admin-quick-support-requests"
                  >
                    <Trans>Support requests</Trans>
                  </Button>
                </Stack>
              </Stack>
            </Panel>

            <Panel
              bordered
              header={
                <div>
                  <strong>
                    <Trans>Admin workspace</Trans>
                  </strong>
                  {adminStatus && (
                    <span style={{ marginLeft: 8, opacity: 0.65 }}>
                      {str("Secure access confirmed")}
                    </span>
                  )}
                </div>
              }
            >
              <p style={{ marginTop: 0, opacity: 0.7 }}>
                <Trans>Open tools and manage backend operations.</Trans>
              </p>
              <AdminTools className="fade-in-simple" />
            </Panel>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminPage;
