import React, { useCallback } from 'react';
import { Navbar, Dropdown, Nav } from 'rsuite';
import { useNavigate } from "react-router-dom";
import OffRoundIcon from '@rsuite/icons/OffRound';
import { logout } from '../../utils/authFetch';
import './TopBarDashboard.css';
import { handleOpenNewTab } from '../../utils/utils';
import { Menu } from 'lucide-react';

const TopBarDashboard = () => {
  const navigate = useNavigate();

  // Use useCallback to memoize handleSelect, preventing unnecessary re-renders of Dropdown.Item components.
  const handleSelect = useCallback((eventKey) => {
    console.log(eventKey);
    switch (eventKey) {
      case 'logout':
        // No need for console.log in production code unless debugging
        logout();
        navigate("/");
        break;
      case 'manage':
        // No need for console.log in production code unless debugging
        navigate("/cabinet");
        break;
      case 'report':
        // No need for console.log in production code unless debugging
        // Implement feedback submission logic here (e.g., open a modal, navigate to a feedback page)
        handleOpenNewTab("/report");
        break;
      default:
        break;
    }
  }, [navigate]); // navigate is a dependency, though it's stable from useNavigate

  return (
    <Navbar className="top-bar-dashboard blurred-background">
      <Navbar.Brand
        style={{ margin: '0', padding: 0, paddingLeft: '8pt' }}
        onClick={() => navigate('/dashboard')} // Directly use onClick for navigation
      >
        <span className='topbar-header-brand'>autolab</span>
      </Navbar.Brand>
      <Nav pullRight>
        <Dropdown title="" icon={<Menu />} placement="bottomEnd" trigger={['click', 'hover']}>
          <Dropdown.Item eventKey="logout" onSelect={handleSelect}>Вийти</Dropdown.Item>
          <Dropdown.Item eventKey="manage" onSelect={handleSelect}>Налаштування</Dropdown.Item>
          <Dropdown.Separator/>
          <Dropdown.Item eventKey="report" onSelect={handleSelect}>Надіслати відгук</Dropdown.Item>
        </Dropdown>
      </Nav>
    </Navbar>
  );
};

export default TopBarDashboard;