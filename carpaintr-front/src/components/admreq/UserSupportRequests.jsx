import React, { useEffect, useState } from 'react';
import { Drawer } from 'rsuite';
import './UserSupportRequests.css';
import { authFetch } from '../../utils/authFetch';
import SupportTicketView from '../support/SupportTicketView';
import { useMediaQuery } from 'react-responsive';

export default function UserSupportRequests() {
  const [requests, setRequests] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    authFetch('/api/v1/user/support_requests')
      .then(res => res.json())
      .then(setRequests)
      .catch(() => alert('Failed to load support requests'));
  }, []);

  const trim = (str, len) => (str?.length > len ? str.slice(0, len) + '...' : str || '');
  const getLastMessage = (req) => req.messages?.[req.messages.length - 1];

  const openDrawer = (req) => {
    setSelectedTicket(req);
    setDrawerOpen(true);
  };

  const isMobile = useMediaQuery({ maxWidth: 767 });

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedTicket(null);
    authFetch('/api/v1/user/support_requests')
      .then(res => res.json())
      .then(setRequests)
      .catch(() => alert('Failed to load support requests'));
  };

  return (
    <div className="user-support-list">
      <h2>Your Support Requests</h2>
      {requests.length === 0 ? (
        <p>No support requests found.</p>
      ) : (
        requests.map((req) => {
          const lastMsg = getLastMessage(req);
          return (
            <div className="support-card" key={req.id} onClick={() => openDrawer(req)}>
              <div className="support-header">
                <span className="support-title">{req.title}</span>
                <span className="support-id">ID: {req.id}</span>
              </div>

              <div className="support-description">
                Description: {trim(req.description, 20)}
              </div>

              <div
                className={`support-last-message ${
                  lastMsg?.isSupportResponse ? 'support-message' : 'user-message'
                }`}
              >
                Last: {trim(lastMsg?.text, 20)}
                {lastMsg?.resolved && (
                  <span className="resolved-badge">Resolved</span>
                )}
              </div>
            </div>
          );
        })
      )}

      <Drawer size={isMobile ? "full" : "md"} placement="right" open={drawerOpen} onClose={closeDrawer}>
        <Drawer.Header>
          <Drawer.Title>Support Request</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body>
          {selectedTicket && <SupportTicketView ticket={selectedTicket} isSupport={false} />}
        </Drawer.Body>
      </Drawer>
    </div>
  );
}
