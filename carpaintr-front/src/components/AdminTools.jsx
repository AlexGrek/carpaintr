import React, { Suspense, lazy } from "react";
import { Nav, Container, Dropdown, Loader, Panel } from "rsuite";
import {
  Bell,
  ClipboardList,
  FileText,
  HardDrive,
  Menu,
  Server,
  Ticket,
  UserPlus,
  Users,
} from "lucide-react";
import { useMediaQuery } from "react-responsive";
import {
  Routes,
  Route,
  Link,
  useLocation,
  useMatch,
  useResolvedPath,
} from "react-router-dom";

// Lazy load the components
const CreateUser = lazy(() => import("./CreateUser"));
const ManageUsers = lazy(() => import("./ManageUsers"));
const ServerLogs = lazy(() => import("./ServerLogs"));
const InvitesPanel = lazy(() => import("./license/InvitesPanel"));
const AdminPanelRequests = lazy(() => import("./admreq/AdminPanelRequests"));
const NotificationsPanel = lazy(() => import("./admin/NotificationsPanel"));
const FilesystemBrowser = lazy(() => import("./editor/FilesystemBrowser"));
const ServerStatus = lazy(() => import("./ServerStatus"));

// Custom Nav.Item component wrapped in React.memo for performance
const NavLink = React.memo(function NavLink({ children, to, ...props }) {
  const resolved = useResolvedPath(to);
  const match = useMatch({ path: resolved.pathname, end: true });

  return (
    <Nav.Item as={Link} to={to} active={!!match} {...props}>
      {children}
    </Nav.Item>
  );
});

// Custom Dropdown.Item component wrapped in React.memo for performance
const DropdownNavLink = React.memo(function DropdownNavLink({
  children,
  to,
  ...props
}) {
  const resolved = useResolvedPath(to);
  const match = useMatch({ path: resolved.pathname, end: true });

  return (
    <Dropdown.Item as={Link} to={to} active={!!match} {...props}>
      {children}
    </Dropdown.Item>
  );
});

// Defined outside the component to prevent recreation on every render
const adminFilesystemConfig = [
  {
    name: "root",
    listEndpoint: "admin/editor/list_files",
    readEndpoint: "admin/editor/read_file",
    uploadEndpoint: "admin/editor/upload_file",
    deleteEndpoint: "admin/editor/delete_file",
  },
];

const AdminTools = () => {
  const isMobile = useMediaQuery({ maxWidth: 767 });
  const location = useLocation();

  const sections = [
    {
      path: "create-user",
      title: "Створити користувача",
      icon: UserPlus,
      component: <CreateUser />,
    },
    {
      path: "manage-users",
      title: "Керування користувачами",
      icon: Users,
      component: <ManageUsers />,
    },
    {
      path: "invites",
      title: "Запрошення",
      icon: Ticket,
      component: <InvitesPanel />,
    },
    {
      path: "logs",
      title: "Логи",
      icon: FileText,
      component: <ServerLogs />,
    },
    {
      path: "data",
      title: "Стан сервера",
      icon: Server,
      component: <ServerStatus />,
    },
    {
      path: "requests",
      title: "Запити",
      icon: ClipboardList,
      component: <AdminPanelRequests />,
    },
    {
      path: "notifications",
      title: "Сповіщення",
      icon: Bell,
      component: <NotificationsPanel />,
    },
    {
      path: "files",
      title: "Файли",
      icon: HardDrive,
      component: <FilesystemBrowser filesystems={adminFilesystemConfig} />,
    },
  ];

  const getSectionActive = (sectionPath) => {
    const path = location.pathname.replace(/\/+$/, "");
    return path.endsWith(`/app/admin/${sectionPath}`);
  };

  const activeSection = sections.find((section) =>
    getSectionActive(section.path),
  );
  const activeTitle = activeSection?.title || sections[0].title;

  const renderNav = () => {
    if (isMobile) {
      return (
        <Dropdown
          title={
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <Menu size={16} />
              {activeTitle}
            </span>
          }
          trigger="click"
          placement="bottomStart"
          style={{ marginBottom: 16 }}
          data-testid="admin-nav-mobile-dropdown"
        >
          {sections.map((section) => (
            <DropdownNavLink
              to={section.path}
              key={section.path}
              data-testid={`admin-nav-mobile-${section.path}`}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <section.icon size={15} />
                {section.title}
              </span>
            </DropdownNavLink>
          ))}
        </Dropdown>
      );
    }

    return (
      <Nav appearance="subtle" style={{ marginBottom: 16 }}>
        {sections.map((section) => (
          <NavLink
            to={section.path}
            key={section.path}
            data-testid={`admin-nav-${section.path}`}
          >
            <span
              style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
            >
              <section.icon size={15} />
              {section.title}
            </span>
          </NavLink>
        ))}
      </Nav>
    );
  };

  return (
    <div
      style={{ marginTop: 8, width: "100%" }}
      data-testid="admin-tools-container"
    >
      <Panel
        bordered
        style={{ background: "var(--rs-bg-card, #fff)" }}
        bodyFill
        data-testid="admin-tools-panel"
      >
        {renderNav()}

        <Container>
          <Suspense fallback={<Loader content="Loading admin tools..." center />}>
            <Routes>
              <Route index element={sections[0].component} />
              {sections.map((section) => (
                <Route
                  key={section.path}
                  path={section.path}
                  element={section.component}
                />
              ))}
            </Routes>
          </Suspense>
        </Container>
      </Panel>
    </div>
  );
};

export default AdminTools;
