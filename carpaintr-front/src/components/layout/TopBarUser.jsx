import { useCallback, useState } from "react";
import { Navbar, Dropdown, Nav } from "rsuite";
import { useNavigate } from "react-router-dom";
import { logout } from "../../utils/authFetch";
import { useNotificationCount } from "../NotificationCountContext";
import NotificationsDrawer from "../NotificationsDrawer";
import "./TopBarUser.css";
import { handleOpenNewTab } from "../../utils/utils";
import { Bell, Menu } from "lucide-react";

const TopBarUser = () => {
  const navigate = useNavigate();
  const { unreadCount } = useNotificationCount();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Use useCallback to memoize handleSelect, preventing unnecessary re-renders of Dropdown.Item components.
  const handleSelect = useCallback(
    (eventKey) => {
      switch (eventKey) {
        case "logout":
          logout();
          navigate("/");
          break;
        case "manage":
          navigate("/app/cabinet");
          break;
        case "notifications":
          navigate("/app/notifications");
          break;
        case "report":
          handleOpenNewTab("/report");
          break;
        default:
          break;
      }
    },
    [navigate],
  );

  return (
    <>
    <Navbar
      appearance="inverse"
      className="top-bar-user fade-in-simple"
      style={{ marginBottom: "18pt" }}
    >
      <Navbar.Brand
        style={{ margin: "0", padding: 0, paddingLeft: "8pt" }}
        onClick={() => navigate("/app/dashboard")} // Directly use onClick for navigation
      >
        <span className="topbar-header-brand">autolab</span>
      </Navbar.Brand>
      <Navbar.Content align="end">
        <Nav>
          <button
            type="button"
            className="top-bar-user-notifications-btn"
            onClick={() => setDrawerOpen(true)}
            aria-label="Notifications"
            data-testid="notifications-bell-button"
          >
            <Bell size={22} strokeWidth={2} />
            {unreadCount > 0 && (
              <span className="top-bar-user-notifications-badge">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>
          <Dropdown
            title=""
            icon={<Menu />}
            placement="bottomEnd"
            trigger={["click", "hover"]}
          >
            <Dropdown.Item eventKey="logout" onSelect={handleSelect}>
              Вийти
            </Dropdown.Item>
            <Dropdown.Item eventKey="manage" onSelect={handleSelect}>
              Налаштування
            </Dropdown.Item>
            <Dropdown.Item eventKey="notifications" onSelect={handleSelect}>
              Мої сповіщення
            </Dropdown.Item>
            <Dropdown.Separator />
            <Dropdown.Item eventKey="report" onSelect={handleSelect}>
              Надіслати відгук
            </Dropdown.Item>
          </Dropdown>
        </Nav>
      </Navbar.Content>
    </Navbar>
    <NotificationsDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
};

export default TopBarUser;
