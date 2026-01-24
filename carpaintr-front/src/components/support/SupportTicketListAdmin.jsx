import { useEffect, useState } from "react";
import { Table, Button, Drawer, IconButton } from "rsuite";
import SupportTicketView from "./SupportTicketView";
import "./SupportTicketListAdmin.css";
import { authFetch } from "../../utils/authFetch";
import { Plus } from "lucide-react";

const { Column, HeaderCell, Cell } = Table;

function trimText(text, maxLength) {
  if (!text) return "";
  return text.length > maxLength ? text.slice(0, maxLength) + "..." : text;
}

export default function SupportTicketListAdmin() {
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [isShowOnlyUnresponded, setIsShowOnlyUnresponded] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const fetchTickets = async () => {
    const res = await authFetch("/api/v1/admin/support_all");
    const data = await res.json();
    setTickets(data);
  };

  const fetchTicketsUnresponded = async () => {
    const res = await authFetch("/api/v1/admin/support_unresponded");
    const data = await res.json();
    setTickets(data);
  };

  useEffect(() => {
    if (isShowOnlyUnresponded) {
      fetchTicketsUnresponded();
      return;
    }
    fetchTickets();
  }, [isShowOnlyUnresponded]);

  const openTicket = (ticket) => {
    setSelectedTicket(ticket);
    setDrawerOpen(true);
  };

  const handleDelete = async (ticket) => {
    const params = new URLSearchParams({ email: ticket.email, id: ticket.id });
    const response = await authFetch(
      `/api/v1/admin/support_delete?${params.toString()}`,
      {
        method: "DELETE",
      },
    );
    if (!response.ok) {
      console.error("Failed to send delete request");
    } else {
      if (isShowOnlyUnresponded) {
        fetchTicketsUnresponded();
        return;
      }
      fetchTickets();
    }
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedTicket(null);
  };

  const getLastMessageText = (messages) => {
    if (!messages || messages.length === 0) return "";
    return messages[messages.length - 1].text;
  };

  const formatDate = (utc) => new Date(utc).toLocaleString();

  return (
    <div className="admin-ticket-list">
      <h2>Support Tickets</h2>
      <div style={{ fontSize: "small" }}>
        {isShowOnlyUnresponded && (
          <p>
            Showing only unresponded (new) tickets.{" "}
            <IconButton
              icon={<Plus />}
              appearance="subtle"
              onClick={() => setIsShowOnlyUnresponded(false)}
            >
              Show all
            </IconButton>
          </p>
        )}
      </div>
      <Table
        data={tickets}
        autoHeight
        rowHeight={60}
        wordWrap
        hover
        bordered
        style={{ width: "100%", textAlign: "left" }}
      >
        <Column width={100}>
          <HeaderCell>ID</HeaderCell>
          <Cell dataKey="id" />
        </Column>

        <Column width={180} resizable>
          <HeaderCell>Title</HeaderCell>
          <Cell dataKey="title" />
        </Column>

        <Column width={150} resizable>
          <HeaderCell>Description</HeaderCell>
          <Cell>{(row) => trimText(row.description, 20)}</Cell>
        </Column>

        <Column width={120}>
          <HeaderCell>Type</HeaderCell>
          <Cell dataKey="req_type" />
        </Column>

        <Column width={200}>
          <HeaderCell>Email</HeaderCell>
          <Cell dataKey="email" />
        </Column>

        <Column width={180}>
          <HeaderCell>Created</HeaderCell>
          <Cell>{(row) => formatDate(row.timestamp)}</Cell>
        </Column>

        <Column flexGrow={1}>
          <HeaderCell>Last Message</HeaderCell>
          <Cell>{(row) => trimText(getLastMessageText(row.messages), 30)}</Cell>
        </Column>

        <Column width={160}>
          <HeaderCell style={{ textAlign: "center" }}>Actions</HeaderCell>
          <Cell>
            {(row) => (
              <div className="table-actions">
                <Button
                  size="xs"
                  appearance="primary"
                  onClick={() => openTicket(row)}
                >
                  OPEN
                </Button>
                <Button
                  size="xs"
                  appearance="subtle"
                  color="red"
                  onClick={async () => await handleDelete(row)}
                >
                  DELETE
                </Button>
              </div>
            )}
          </Cell>
        </Column>
      </Table>

      <Drawer
        size="full"
        placement="right"
        open={drawerOpen}
        onClose={closeDrawer}
      >
        <Drawer.Header>
          <Drawer.Title>Support Ticket</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body>
          {selectedTicket && (
            <SupportTicketView ticket={selectedTicket} isSupport={true} />
          )}
        </Drawer.Body>
      </Drawer>
    </div>
  );
}
