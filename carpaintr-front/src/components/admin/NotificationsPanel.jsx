import React, { useState, useCallback } from "react";
import {
  Panel,
  Button,
  Form,
  Table,
  Loader,
  Message,
  Input,
} from "rsuite";
import { authFetch } from "../../utils/authFetch";
import { useLocale, registerTranslations } from "../../localization/LocaleContext";
import ErrorMessage from "../layout/ErrorMessage";
import ReloadIcon from "@rsuite/icons/Reload";

const { Column, HeaderCell, Cell } = Table;

registerTranslations("ua", {
  "Notifications": "Сповіщення",
  "Send notification": "Надіслати сповіщення",
  "Email (user)": "Email (користувач)",
  "Title": "Заголовок",
  "Body": "Текст",
  "Send to user": "Надіслати користувачу",
  "Broadcast to all": "Розіслати всім",
  "All notifications": "Усі сповіщення",
  "Refresh": "Оновити",
  "Read": "Прочитано",
  "No notifications loaded. Click Refresh to load.":
    "Сповіщення не завантажено. Натисніть Оновити.",
  "Notification sent.": "Сповіщення надіслано.",
  "Broadcast sent to {n} users.": "Розсилка надіслана {n} користувачам.",
  "Error": "Помилка",
  "Failed to fetch notifications": "Не вдалося завантажити сповіщення",
  "Email is required to send to a user.":
    "Вкажіть email для надсилання одному користувачу.",
  "Title is required.": "Заголовок обов'язковий.",
  "Failed to send notification": "Не вдалося надіслати сповіщення",
  "Title is required for broadcast.": "Для розсилки потрібен заголовок.",
  "Failed to load user list": "Не вдалося завантажити список користувачів",
  "No users to broadcast to.": "Немає користувачів для розсилки.",
  "Broadcast failed": "Розсилка не вдалася",
  "user@example.com (for single user only)":
    "user@example.com (лише для одного користувача)",
  "Loading...": "Завантаження...",
  "Yes": "Так",
  "No": "Ні",
  "Email": "Email",
  "Date": "Дата",
});

function trimText(text, maxLength) {
  if (!text) return "";
  return text.length > maxLength ? text.slice(0, maxLength) + "..." : text;
}

function formatDate(utc) {
  if (!utc) return "";
  return new Date(utc).toLocaleString();
}

export default function NotificationsPanel() {
  const { str } = useLocale();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [formValue, setFormValue] = useState({
    email: "",
    title: "",
    body: "",
  });
  const [hasFetchedOnce, setHasFetchedOnce] = useState(false);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const response = await authFetch("/api/v1/admin/notifications");
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `${str("Error")}: ${response.status}`);
      }
      const data = await response.json();
      setNotifications(Array.isArray(data) ? data : []);
      setHasFetchedOnce(true);
    } catch (err) {
      setError(err.message || str("Failed to fetch notifications"));
    } finally {
      setLoading(false);
    }
  }, [str]);

  const handleSendToUser = async () => {
    const email = (formValue.email || "").trim();
    const title = (formValue.title || "").trim();
    const body = formValue.body || "";
    if (!email) {
      setError(str("Email is required to send to a user."));
      return;
    }
    if (!title) {
      setError(str("Title is required."));
      return;
    }
    setSendLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const response = await authFetch("/api/v1/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, title, body }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || str("Failed to send notification"));
      }
      setSuccessMessage(str("Notification sent."));
      setFormValue((prev) => ({ ...prev, email: "", title: "", body: "" }));
      if (hasFetchedOnce) {
        const listRes = await authFetch("/api/v1/admin/notifications");
        if (listRes.ok) {
          const data = await listRes.json();
          setNotifications(Array.isArray(data) ? data : []);
        }
      }
    } catch (err) {
      setError(err.message || str("Failed to send notification"));
    } finally {
      setSendLoading(false);
    }
  };

  const handleBroadcast = async () => {
    const title = (formValue.title || "").trim();
    const body = formValue.body || "";
    if (!title) {
      setError(str("Title is required for broadcast."));
      return;
    }
    setSendLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const listRes = await authFetch("/api/v1/admin/listusers");
      if (!listRes.ok) throw new Error(str("Failed to load user list"));
      const emails = await listRes.json();
      if (!Array.isArray(emails) || emails.length === 0) {
        setError(str("No users to broadcast to."));
        setSendLoading(false);
        return;
      }
      let sent = 0;
      for (const email of emails) {
        const response = await authFetch("/api/v1/admin/notifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, title, body }),
        });
        if (response.ok) sent += 1;
      }
      setSuccessMessage(str("Broadcast sent to {n} users.").replace("{n}", String(sent)));
      setFormValue((prev) => ({ ...prev, title: "", body: "" }));
      if (hasFetchedOnce) {
        const listRes2 = await authFetch("/api/v1/admin/notifications");
        if (listRes2.ok) {
          const data = await listRes2.json();
          setNotifications(Array.isArray(data) ? data : []);
        }
      }
    } catch (err) {
      setError(err.message || str("Broadcast failed"));
    } finally {
      setSendLoading(false);
    }
  };

  return (
    <div style={{ width: "100%" }}>
      <ErrorMessage errorText={error} />
      {successMessage && (
        <Message type="success" closable onClose={() => setSuccessMessage(null)}>
          {successMessage}
        </Message>
      )}

      <Panel header={str("Send notification")} bordered style={{ marginBottom: 16 }}>
        <Form
          layout="vertical"
          formValue={formValue}
          onChange={(v) => setFormValue(v)}
        >
          <Form.Group controlId="email">
            <Form.ControlLabel>{str("Email (user)")}</Form.ControlLabel>
            <Input
              name="email"
              value={formValue.email}
              onChange={(v) => setFormValue((prev) => ({ ...prev, email: v }))}
              placeholder={str("user@example.com (for single user only)")}
            />
          </Form.Group>
          <Form.Group controlId="title">
            <Form.ControlLabel>{str("Title")}</Form.ControlLabel>
            <Input
              name="title"
              value={formValue.title}
              onChange={(v) => setFormValue((prev) => ({ ...prev, title: v }))}
            />
          </Form.Group>
          <Form.Group controlId="body">
            <Form.ControlLabel>{str("Body")}</Form.ControlLabel>
            <Input
              name="body"
              value={formValue.body}
              onChange={(v) => setFormValue((prev) => ({ ...prev, body: v }))}
              as="textarea"
              rows={3}
            />
          </Form.Group>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button
              appearance="primary"
              loading={sendLoading}
              onClick={handleSendToUser}
            >
              {str("Send to user")}
            </Button>
            <Button
              appearance="default"
              loading={sendLoading}
              onClick={handleBroadcast}
            >
              {str("Broadcast to all")}
            </Button>
          </div>
        </Form>
      </Panel>

      <Panel header={str("All notifications")} bordered>
        <div style={{ marginBottom: 8 }}>
          <Button
            appearance="subtle"
            startIcon={<ReloadIcon />}
            onClick={fetchNotifications}
            loading={loading}
          >
            {str("Refresh")}
          </Button>
        </div>
        {loading && <Loader backdrop content={str("Loading...")} />}
        {!hasFetchedOnce && !loading && (
          <Message type="info" style={{ marginBottom: 8 }}>
            {str("No notifications loaded. Click Refresh to load.")}
          </Message>
        )}
        <Table
          data={notifications}
          rowKey={(row) => `${row.email}-${row.id}`}
          autoHeight
          rowHeight={52}
          wordWrap
          hover
          bordered
          style={{ width: "100%", textAlign: "left" }}
          rowClassName={(row) => (row.read ? "notification-row-read" : "")}
        >
          <Column width={80}>
            <HeaderCell>{str("Read")}</HeaderCell>
            <Cell>{(row) => (row.read ? str("Yes") : str("No"))}</Cell>
          </Column>
          <Column width={180} resizable>
            <HeaderCell>{str("Email")}</HeaderCell>
            <Cell dataKey="email" />
          </Column>
          <Column width={200} resizable>
            <HeaderCell>{str("Title")}</HeaderCell>
            <Cell dataKey="title" />
          </Column>
          <Column flexGrow={1} resizable>
            <HeaderCell>{str("Body")}</HeaderCell>
            <Cell>{(row) => trimText(row.body, 60)}</Cell>
          </Column>
          <Column width={160}>
            <HeaderCell>{str("Date")}</HeaderCell>
            <Cell>{(row) => formatDate(row.timestamp)}</Cell>
          </Column>
        </Table>
      </Panel>

      <style>{`
        .notification-row-read {
          background-color: #f0f0f0 !important;
          color: #888;
        }
        .notification-row-read .rs-table-cell-content {
          color: #888;
        }
      `}</style>
    </div>
  );
}
