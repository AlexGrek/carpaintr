import { useEffect, useState } from "react";
import { Loader, Message, Panel, Table } from "rsuite";
import { authFetch } from "../../utils/authFetch";
import { useLocale, registerTranslations } from "../../localization/LocaleContext";
import Trans from "../../localization/Trans";

registerTranslations("ua", {
  "Most recently active users": "Останні активні користувачі",
  "Last authenticated request per user, most recent first.":
    "Останній автентифікований запит користувача, від найновішого.",
  Email: "Email",
  "Last visit": "Останній візит",
  "No activity recorded yet.": "Активності ще не зафіксовано.",
});

const RECENT_USERS_LIMIT = 10;

const formatTimestamp = (iso) => {
  if (!iso) return "";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
};

const RecentUsersStats = () => {
  const { str } = useLocale();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rows, setRows] = useState([]);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await authFetch(
          `/api/v1/admin/last_visit/recent?limit=${RECENT_USERS_LIMIT}`,
        );
        if (!response.ok) {
          throw new Error(`${str("Error: ")}${response.statusText}`);
        }
        const data = await response.json();
        if (!cancelled) setRows(data);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [str]);

  return (
    <Panel
      bordered
      header={
        <strong>
          <Trans>Most recently active users</Trans>
        </strong>
      }
      data-testid="admin-recent-users-panel"
    >
      <p style={{ marginTop: 0, opacity: 0.7 }}>
        <Trans>Last authenticated request per user, most recent first.</Trans>
      </p>
      {error && (
        <Message
          type="error"
          showIcon
          closable
          data-testid="admin-recent-users-error"
        >
          {error}
        </Message>
      )}
      {loading ? (
        <Loader content={str("Loading...")} data-testid="admin-recent-users-loader" />
      ) : rows.length === 0 ? (
        <p style={{ opacity: 0.7 }} data-testid="admin-recent-users-empty">
          <Trans>No activity recorded yet.</Trans>
        </p>
      ) : (
        <Table
          data={rows}
          autoHeight
          cellBordered
          style={{ backgroundColor: "white" }}
          data-testid="admin-recent-users-table"
        >
          <Table.Column flexGrow={1} minWidth={200}>
            <Table.HeaderCell>{str("Email")}</Table.HeaderCell>
            <Table.Cell dataKey="email" />
          </Table.Column>
          <Table.Column width={220}>
            <Table.HeaderCell>{str("Last visit")}</Table.HeaderCell>
            <Table.Cell>{(rowData) => formatTimestamp(rowData.last_visit)}</Table.Cell>
          </Table.Column>
        </Table>
      )}
    </Panel>
  );
};

export default RecentUsersStats;
