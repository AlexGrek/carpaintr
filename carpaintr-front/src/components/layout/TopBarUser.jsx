import React, { useCallback } from 'react';
import { Navbar, Dropdown, Nav } from 'rsuite';
import { useNavigate } from "react-router-dom";
import OffRoundIcon from '@rsuite/icons/OffRound';
import { logout } from '../../utils/authFetch';
import './TopBarUser.css';

const TopBarUser = () => {
  const navigate = useNavigate();

  // Use useCallback to memoize handleSelect, preventing unnecessary re-renders of Dropdown.Item components.
  const handleSelect = useCallback((eventKey) => {
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
        console.log('Navigating to report (feedback submission not implemented yet)');
        break;
      default:
        break;
    }
  }, [navigate]); // navigate is a dependency, though it's stable from useNavigate

  return (
    <Navbar appearance="inverse" className="top-bar-user" style={{ marginBottom: "18pt" }}>
      <Navbar.Brand
        style={{ margin: '0', padding: 0, paddingLeft: '8pt' }}
        onClick={() => navigate('/dashboard')} // Directly use onClick for navigation
        as="a" // Treat Navbar.Brand as an anchor for better semantic HTML
        href="/dashboard" // Provide href for accessibility and default link behavior
      >
        <span className='topbar-header-brand'>autolab</span>
      </Navbar.Brand>
      <Nav pullRight>
        <Dropdown title="Меню" icon={<OffRoundIcon />} placement="bottomEnd" onSelect={handleSelect}>
          <Dropdown.Item eventKey="logout">Вийти</Dropdown.Item>
          <Dropdown.Item eventKey="manage">Налаштування</Dropdown.Item>
          <Dropdown.Item eventKey="report">Надіслати відгук</Dropdown.Item>
        </Dropdown>
      </Nav>
    </Navbar>
  );
};

export default TopBarUser;