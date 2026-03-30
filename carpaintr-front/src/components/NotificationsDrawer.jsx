import { useEffect, useState } from "react";
import { Drawer, List, Loader, Message } from "rsuite";
import { Link } from "react-router-dom";
import { authFetch } from "../utils/authFetch";
import { Bell } from "lucide-react";
import { useLocale, registerTranslations } from "../localization/LocaleContext";

registerTranslations("ua", {
  "Notifications": "Сповіщення",
  "No notifications": "Немає сповіщень",
  "Failed to load notifications": "Не вдалося завантажити сповіщення",
  "View all notifications": "Всі сповіщення",
});

function formatDate(utc) {
  if (!utc) return "";
  return new Date(utc).toLocaleString();
}

const NotificationsDrawer = ({ open, onClose }) => {
  const { str } = useLocale();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    authFetch("/api/v1/notifications")
      .then((resp) => {
        if (!resp.ok) throw new Error(str("Failed to load notifications"));
        return resp.json();
      })
      .then((data) => {
        if (!cancelled) setNotifications(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || str("Failed to load notifications"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [open, str]);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      placement="right"
      size="xs"
      data-testid="notifications-drawer"
    >
      <Drawer.Header>
        <Drawer.Title>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Bell size={18} />
            {str("Notifications")}
          </span>
        </Drawer.Title>
      </Drawer.Header>
      <Drawer.Body style={{ padding: "12px 16px" }}>
        {error && (
          <Message type="error" closable onClose={() => setError(null)} style={{ marginBottom: 12 }}>
            {error}
          </Message>
        )}
        {loading && <Loader center content="" />}
        {!loading && !error && notifications.length === 0 && (
          <Message type="info">{str("No notifications")}</Message>
        )}
        {!loading && notifications.length > 0 && (
          <List bordered>
            {notifications.map((n) => (
              <List.Item key={`${n.email}-${n.id}`}>
                <div style={{ opacity: n.read ? 0.7 : 1, padding: "2px 0" }}>
                  <div style={{ fontWeight: n.read ? 400 : 600, marginBottom: 2 }}>
                    {n.title}
                  </div>
                  {n.body && (
                    <div
                      style={{
                        color: "var(--rs-text-secondary)",
                        fontSize: "0.88em",
                        marginBottom: 2,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {n.body}
                    </div>
                  )}
                  <div style={{ fontSize: "0.82em", color: "var(--rs-text-tertiary)" }}>
                    {formatDate(n.timestamp)}
                  </div>
                </div>
              </List.Item>
            ))}
          </List>
        )}
        <div style={{ marginTop: 16, textAlign: "center" }}>
          <Link
            to="/app/notifications"
            onClick={onClose}
            data-testid="notifications-drawer-view-all-link"
          >
            {str("View all notifications")}
          </Link>
        </div>
      </Drawer.Body>
    </Drawer>
  );
};

export default NotificationsDrawer;
