import React from 'react';
import { Nav, Container, Dropdown } from 'rsuite';
import { Menu } from 'lucide-react'; // Import Menu icon from lucide-react
import { useMediaQuery } from 'react-responsive';
import {
  Routes,
  Route,
  Link,
  useMatch,
  useResolvedPath
} from 'react-router-dom';

import CreateUser from './CreateUser';
import ManageUsers from './ManageUsers';
import ServerLogs from './ServerLogs';
import AdminPanelRequests from './admreq/AdminPanelRequests';
import FilesystemBrowser from './editor/FilesystemBrowser';

// Custom Nav.Item component to handle active state with React Router
const NavLink = ({ children, to, ...props }) => {
  let resolved = useResolvedPath(to);
  let match = useMatch({ path: resolved.pathname, end: true });

  return (
    <Nav.Item as={Link} to={to} active={match ? true : false} {...props}>
      {children}
    </Nav.Item>
  );
};

// Custom Dropdown.Item component to handle active state with React Router
const DropdownNavLink = ({ children, to, ...props }) => {
  let resolved = useResolvedPath(to);
  let match = useMatch({ path: resolved.pathname, end: true });

  return (
    <Dropdown.Item as={Link} to={to} active={match ? true : false} {...props}>
      {children}
    </Dropdown.Item>
  );
};

const adminFilesystemConfig = [
    {
      name: "root", // A name for your single filesystem
      listEndpoint: "admin/editor/list_files",
      readEndpoint: "admin/editor/read_file",
      uploadEndpoint: "admin/editor/upload_file",
      deleteEndpoint: "admin/editor/delete_file"
    }
  ];


const AdminTools = () => {
  const isMobile = useMediaQuery({ maxWidth: 767 }); // Define your mobile breakpoint

  const sections = [
    {
      path: 'add-user',
      title: 'Додати користувача',
      component: <CreateUser />
    },
    {
      path: 'manage-users',
      title: 'Керування користувачами',
      component: <ManageUsers />
    },
    {
      path: 'logs',
      title: 'Логи',
      component: <ServerLogs />
    },
    {
      path: 'data',
      title: 'Дані',
      component: <ManageUsers />
    },
    {
      path: 'requests',
      title: 'Запити',
      component: <AdminPanelRequests />
    },
    {
      path: 'files',
      title: 'Файли',
      component: <FilesystemBrowser filesystems={adminFilesystemConfig}/>
    }
  ];

  return (
    <div style={{ marginTop: '20px', width: "100%" }}>
      {isMobile ? (
        <Dropdown
          title={<Menu/>}
          trigger="click" // Use 'click' to open the dropdown
          placement="bottomStart"
          style={{ marginBottom: '20px' }}
          renderTrigger={({ onClose, left, top, className }, ref) => {
            return (
              <Menu // Lucide Menu icon
                ref={ref}
                className={className}
                style={{ left, top, cursor: 'pointer', fontSize: '28px', padding: '5px' }} // Adjust size and padding as needed
                onClick={onClose} // You might want to toggle here, or rely on rsuite's dropdown logic
              />
            );
          }}
        >
          {sections.map(section => (
            <DropdownNavLink to={section.path} key={section.path}>
              {section.title}
            </DropdownNavLink>
          ))}
        </Dropdown>
      ) : (
        <Nav appearance="subtle" style={{ marginBottom: '20px' }}>
          {sections.map(section => (
            <NavLink to={section.path} key={section.path}>
              {section.title}
            </NavLink>
          ))}
        </Nav>
      )}

      <Container>
        <Routes>
          <Route index element={<CreateUser />} />
          {sections.map(section => (
            <Route
              key={section.path}
              path={section.path}
              element={section.component}
            />
          ))}
        </Routes>
      </Container>
    </div>
  );
};

export default AdminTools;