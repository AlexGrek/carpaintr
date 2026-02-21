import { useCallback } from "react";
import { Navbar, Dropdown, Nav } from "rsuite";
import { useNavigate } from "react-router-dom";
import { logout } from "../../utils/authFetch";
import { useNotificationCount } from "../NotificationCountContext";
import "./TopBarUser.css";
import { handleOpenNewTab } from "../../utils/utils";
import { Bell, Menu } from "lucide-react";

const TopBarUser = () => {
  const navigate = useNavigate();
  const { unreadCount } = useNotificationCount();

  // Use useCallback to memoize handleSelect, preventing unnecessary re-renders of Dropdown.Item components.
  const handleSelect = useCallback(
    (eventKey) => {
      console.log(eventKey);
      switch (eventKey) {
        case "logout":
          // No need for console.log in production code unless debugging
          logout();
          navigate("/");
          break;
        case "manage":
          // No need for console.log in production code unless debugging
          navigate("/app/cabinet");
          break;
        case "notifications":
          navigate("/app/notifications");
          break;
        case "report":
          // No need for console.log in production code unless debugging
          // Implement feedback submission logic here (e.g., open a modal, navigate to a feedback page)
          handleOpenNewTab("/report");
          break;
        default:
          break;
      }
    },
    [navigate],
  ); // navigate is a dependency, though it's stable from useNavigate

  return (
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
            onClick={() => navigate("/app/notifications")}
            aria-label="Notifications"
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
  );
};

export default TopBarUser;
