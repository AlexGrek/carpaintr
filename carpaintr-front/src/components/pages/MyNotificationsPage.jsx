import { useEffect, useState } from "react";
import { Loader, Panel, List, Message } from "rsuite";
import TopBarUser from "../layout/TopBarUser";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import {
  useLocale,
  registerTranslations,
} from "../../localization/LocaleContext";
import { authFetch } from "../../utils/authFetch";
import ActiveLicenseMarker from "../ActiveLicenseMarker";
import { Bell } from "lucide-react";

registerTranslations("ua", {
  "My notifications": "Мої сповіщення",
  "Document title: My notifications": "Мої сповіщення",
  "No notifications": "Немає сповіщень",
  "Failed to load notifications": "Не вдалося завантажити сповіщення",
});

function formatDate(utc) {
  if (!utc) return "";
  return new Date(utc).toLocaleString();
}

const MyNotificationsPage = () => {
  const { str } = useLocale();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  useDocumentTitle("Document title: My notifications");

  useEffect(() => {
    let cancelled = false;

    const loadAndMarkRead = async () => {
      setLoading(true);
      try {
        const response = await authFetch("/api/v1/notifications");
        if (!response.ok) throw new Error(str("Failed to load notifications"));
        const data = await response.json();
        const list = Array.isArray(data) ? data : [];
        if (cancelled) return;

        setNotifications(list);

        const unread = list.filter((n) => !n.read);
        if (unread.length > 0) {
          await Promise.all(
            unread.map((n) =>
              authFetch(`/api/v1/notifications/${n.id}/read`, {
                method: "PATCH",
              }),
            ),
          );
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || str("Failed to load notifications"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadAndMarkRead();
    return () => {
      cancelled = true;
    };
  }, [str]);

  return (
    <div>
      <TopBarUser />
      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "1em" }}>
        <Panel>
          <ActiveLicenseMarker />
        </Panel>
        <Panel
          header={
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Bell size={20} />
              {str("My notifications")}
            </span>
          }
          bordered
        >
          {error && (
            <Message type="error" closable onClose={() => setError(null)}>
              {error}
            </Message>
          )}
          {loading && (
            <Loader backdrop content={str("Loading...")} center />
          )}
          {!loading && notifications.length === 0 && !error && (
            <Message type="info">{str("No notifications")}</Message>
          )}
          {!loading && notifications.length > 0 && (
            <List hover bordered>
              {notifications.map((n) => (
                <List.Item key={`${n.email}-${n.id}`}>
                  <div
                    style={{
                      opacity: n.read ? 0.75 : 1,
                      padding: "4px 0",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: n.read ? 400 : 600,
                        marginBottom: 4,
                      }}
                    >
                      {n.title}
                    </div>
                    {n.body && (
                      <div
                        style={{
                          color: "var(--rs-text-secondary)",
                          fontSize: "0.9em",
                          marginBottom: 4,
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {n.body}
                      </div>
                    )}
                    <div
                      style={{
                        fontSize: "0.85em",
                        color: "var(--rs-text-tertiary)",
                      }}
                    >
                      {formatDate(n.timestamp)}
                    </div>
                  </div>
                </List.Item>
              ))}
            </List>
          )}
        </Panel>
      </div>
    </div>
  );
};

export default MyNotificationsPage;
