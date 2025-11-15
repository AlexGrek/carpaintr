import React, { Suspense, lazy } from "react";
import { Nav, Container, Dropdown, Loader, Placeholder } from "rsuite";
import { Menu } from "lucide-react";
import { useMediaQuery } from "react-responsive";
import {
  Routes,
  Route,
  Link,
  useMatch,
  useResolvedPath,
} from "react-router-dom";

// Lazy load the components
const CreateUser = lazy(() => import("./CreateUser"));
const ManageUsers = lazy(() => import("./ManageUsers"));
const ServerLogs = lazy(() => import("./ServerLogs"));
const InvitesPanel = lazy(() => import("./license/InvitesPanel"));
const AdminPanelRequests = lazy(() => import("./admreq/AdminPanelRequests"));
const FilesystemBrowser = lazy(() => import("./editor/FilesystemBrowser"));
const ServerStatus = lazy(() => import("./ServerStatus"));

// Custom Nav.Item component wrapped in React.memo for performance
const NavLink = React.memo(({ children, to, ...props }) => {
  const resolved = useResolvedPath(to);
  const match = useMatch({ path: resolved.pathname, end: true });

  return (
    <Nav.Item as={Link} to={to} active={!!match} {...props}>
      {children}
    </Nav.Item>
  );
});

// Custom Dropdown.Item component wrapped in React.memo for performance
const DropdownNavLink = React.memo(({ children, to, ...props }) => {
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

  // sections array can be memoized with useMemo if it were more complex, but it's fine here.
  const sections = [
    {
      path: "home",
      title: "Меню",
      component: <Placeholder.Paragraph />,
    },
    {
      path: "manage-users",
      title: "Керування користувачами",
      component: <ManageUsers />,
    },
    {
      path: "invites",
      title: "Запрошення",
      component: <InvitesPanel />,
    },
    {
      path: "logs",
      title: "Логи",
      component: <ServerLogs />,
    },
    {
      path: "data",
      title: "Стан сервера",
      component: <ServerStatus />,
    },
    {
      path: "requests",
      title: "Запити",
      component: <AdminPanelRequests />,
    },
    {
      path: "files",
      title: "Файли",
      component: <FilesystemBrowser filesystems={adminFilesystemConfig} />,
    },
  ];

  const renderNav = () => {
    if (isMobile) {
      return (
        <Dropdown
          title={<Menu />}
          trigger="click"
          placement="bottomStart"
          style={{ marginBottom: "20px" }}
        >
          {sections.map((section) => (
            <DropdownNavLink to={section.path} key={section.path}>
              {section.title}
            </DropdownNavLink>
          ))}
        </Dropdown>
      );
    }

    return (
      <Nav appearance="subtle" style={{ marginBottom: "20px" }}>
        {sections.map((section) => (
          <NavLink to={section.path} key={section.path}>
            {section.title}
          </NavLink>
        ))}
      </Nav>
    );
  };

  return (
    <div style={{ marginTop: "20px", width: "100%" }}>
      {renderNav()}

      <Container>
        <Suspense fallback={<Loader />}>
          <Routes>
            <Route index element={<CreateUser />} />
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
    </div>
  );
};

export default AdminTools;
