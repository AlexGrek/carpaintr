import { useCallback, useEffect, useState } from "react";
import { Navbar, Dropdown, Nav } from "rsuite";
import { useNavigate } from "react-router-dom";
import { logout } from "../../utils/authFetch";
import "./TopBarDashboard.css";
import { handleOpenNewTab } from "../../utils/utils";
import { LogOut, MessageCircle, Menu, Settings } from "lucide-react";

const SCROLL_THRESHOLD = 8;

const TopBarDashboard = () => {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > SCROLL_THRESHOLD);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
    <Navbar
      className={`top-bar-dashboard ${scrolled ? "top-bar-dashboard-scrolled" : ""}`}
    >
      <Navbar.Brand
        className="top-bar-dashboard-brand"
        style={{ margin: "0", padding: 0, paddingLeft: "8pt" }}
        onClick={() => navigate("/app/dashboard")}
      >
        <span className="topbar-header-brand">autolab</span>
      </Navbar.Brand>
      <Navbar.Content align="end">
        <Nav>
          <Dropdown
            title=""
            renderToggle={(props, ref) => (
              <button
                ref={ref}
                {...props}
                type="button"
                className="top-bar-dashboard-menu-trigger"
                aria-label="Menu"
              >
                <Menu size={22} strokeWidth={2} />
              </button>
            )}
            placement="bottomEnd"
            trigger="click"
            onSelect={handleSelect}
          >
            <Dropdown.Item eventKey="manage" onSelect={handleSelect}>
              <span className="top-bar-dashboard-menu-item">
                <Settings size={16} />
                <span>Налаштування</span>
              </span>
            </Dropdown.Item>
            <Dropdown.Item eventKey="report" onSelect={handleSelect}>
              <span className="top-bar-dashboard-menu-item">
                <MessageCircle size={16} />
                <span>Надіслати відгук</span>
              </span>
            </Dropdown.Item>
            <Dropdown.Separator />
            <Dropdown.Item eventKey="logout" onSelect={handleSelect}>
              <span className="top-bar-dashboard-menu-item top-bar-dashboard-menu-item-logout">
                <LogOut size={16} />
                <span>Вийти</span>
              </span>
            </Dropdown.Item>
          </Dropdown>
        </Nav>
      </Navbar.Content>
    </Navbar>
  );
};

export default TopBarDashboard;
