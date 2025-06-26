import React, { useEffect, useState } from 'react';
import { Table, Button, Drawer } from 'rsuite';
import SupportTicketView from './SupportTicketView';
import './SupportTicketListAdmin.css';
import { authFetch } from '../../utils/authFetch';

const { Column, HeaderCell, Cell } = Table;

function trimText(text, maxLength) {
  if (!text) return '';
  return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
}

export default function SupportTicketListAdmin() {
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const fetchTickets = async () => {
    const res = await authFetch('/api/v1/admin/support_all');
    const data = await res.json();
    setTickets(data);
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const openTicket = (ticket) => {
    setSelectedTicket(ticket);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedTicket(null);
  };

  const getLastMessageText = (messages) => {
    if (!messages || messages.length === 0) return '';
    return messages[messages.length - 1].text;
  };

  const formatDate = (utc) => new Date(utc).toLocaleString();

  return (
    <div className="admin-ticket-list">
      <h2>Support Tickets</h2>
      <Table
        data={tickets}
        autoHeight
        rowHeight={60}
        wordWrap
        hover
        bordered
        style={{ width: '100%' }}
      >
        <Column width={180} resizable>
          <HeaderCell>Title</HeaderCell>
          <Cell dataKey="title" />
        </Column>

        <Column width={150} resizable>
          <HeaderCell>Description</HeaderCell>
          <Cell>{row => trimText(row.description, 20)}</Cell>
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
          <Cell>{row => formatDate(row.timestamp)}</Cell>
        </Column>

        <Column flexGrow={1}>
          <HeaderCell>Last Message</HeaderCell>
          <Cell>{row => trimText(getLastMessageText(row.messages), 30)}</Cell>
        </Column>

        <Column width={160}>
          <HeaderCell>Actions</HeaderCell>
          <Cell>
            {row => (
              <div className="table-actions">
                <Button size="xs" appearance="primary" onClick={() => openTicket(row)}>
                  OPEN
                </Button>
                <Button size="xs" appearance="default" disabled>
                  DELETE
                </Button>
              </div>
            )}
          </Cell>
        </Column>
      </Table>

      <Drawer size="lg" placement="right" open={drawerOpen} onClose={closeDrawer}>
        <Drawer.Header>
          <Drawer.Title>Support Ticket</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body>
          {selectedTicket && <SupportTicketView ticket={selectedTicket} isSupport={true} />}
        </Drawer.Body>
      </Drawer>
    </div>
  );
}
