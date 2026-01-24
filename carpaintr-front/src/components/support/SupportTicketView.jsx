import { useState } from "react";
import { Button, Input, Checkbox } from "rsuite";
import "./SupportTicketView.css";
import { authFetch } from "../../utils/authFetch";
import Trans from "../../localization/Trans";
import { useLocale } from "../../localization/LocaleContext";
import AttachmentList from "../AttachmentList";

export default function SupportTicketView({ ticket, isSupport }) {
  const [localTicket, setLocalTicket] = useState({ ...ticket });
  const [messageText, setMessageText] = useState("");
  const [resolved, setResolved] = useState(false);
  const [loading, setLoading] = useState(false);

  const { str } = useLocale();

  const sendMessage = async () => {
    if (!messageText.trim()) return;

    const baseUrl = isSupport
      ? "/api/v1/admin/support_message"
      : "/api/v1/user/support_message";
    const params = new URLSearchParams({
      email: localTicket.email,
      id: localTicket.id,
    });

    const payload = {
      text: messageText,
      isSupportResponse: isSupport,
      resolved: isSupport ? resolved : undefined,
    };

    setLoading(true);
    await authFetch(`${baseUrl}?${params.toString()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    await refreshTicket();
    setMessageText("");
    setResolved(false);
    setLoading(false);
  };

  const refreshTicket = async () => {
    const params = new URLSearchParams({
      email: localTicket.email,
      id: localTicket.id,
    });
    const res = await authFetch(
      `/api/v1/user/support_request?${params.toString()}`,
    );
    const data = await res.json();
    setLocalTicket(data);
  };

  const formatDate = (utcString) => {
    const date = new Date(utcString);
    return date.toLocaleString();
  };

  return (
    <div className="support-ticket-container">
      <div className="ticket-header">
        <h2>{localTicket.title}</h2>
        <p className="ticket-meta">
          Type: {localTicket.req_type || "General"} | Created:{" "}
          {formatDate(localTicket.timestamp)}
        </p>
        <p className="ticket-description">{localTicket.description}</p>
      </div>

      <div>
        <AttachmentList attachments={localTicket.attachments} />
      </div>

      <div className="ticket-messages">
        {localTicket.messages.map((msg, index) => (
          <div
            key={index}
            className={`message-bubble ${msg.isSupportResponse ? "support" : "user"}`}
          >
            <div className="message-meta">
              {msg.email} · {formatDate(msg.timestamp)}
              {msg.resolved && (
                <span className="resolved-label">
                  ✓ <Trans>Resolved</Trans>
                </span>
              )}
            </div>
            <div className="message-text">{msg.text}</div>
          </div>
        ))}
      </div>

      <div className="ticket-actions">
        <Input
          as="textarea"
          rows={3}
          value={messageText}
          onChange={setMessageText}
          placeholder={str("Type your message...")}
        />
        {isSupport && (
          <Checkbox
            checked={resolved}
            onChange={(_, checked) => setResolved(checked)}
          >
            <Trans>Mark as resolved</Trans>
          </Checkbox>
        )}
        <div className="ticket-buttons">
          <Button appearance="primary" onClick={sendMessage} loading={loading}>
            <Trans>Send</Trans>
          </Button>
          <Button appearance="default" onClick={refreshTicket}>
            <Trans>Refresh</Trans>
          </Button>
        </div>
      </div>
    </div>
  );
}
