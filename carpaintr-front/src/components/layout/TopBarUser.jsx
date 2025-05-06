import React from 'react';
import { Navbar, Dropdown, Nav } from 'rsuite';
import { useNavigate } from "react-router-dom";
import OffRoundIcon from '@rsuite/icons/OffRound';
import { logout } from '../../utils/authFetch';

const TopBarUser = () => {
  const navigate = useNavigate();
  const handleSelect = (eventKey) => {
    console.log(eventKey)
    switch (eventKey) {
      case 'logout':
        console.log('Logging out...');
        logout();
        navigate("/");
        // Add your logout logic here
        break;
      case 'manage':
        console.log('Navigating to manage...');
        navigate("/cabinet");
        // Navigate to manage section
        break;
      case 'report':
        console.log('Navigating to report...');
        // Navigate to report section
        break;
      default:
        break;
    }
  };

  return (
    <Navbar appearance="inverse" className="top-bar-user">
      <Navbar.Brand>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img src="/logo.png" alt="CarPaintr Logo" height="30" />
          <span style={{ fontWeight: 'bold', fontSize: '1.2em' }}>CarPaintr</span>
        </div>
      </Navbar.Brand>
      <Nav pullRight>
        <Dropdown title="Меню" icon={<OffRoundIcon/>} placement="bottomEnd">
          <Dropdown.Item eventKey="logout" onSelect={() => handleSelect("logout")}>Вийти</Dropdown.Item>
          <Dropdown.Item eventKey="manage" onSelect={() => handleSelect("manage")}>Налаштування</Dropdown.Item>
          <Dropdown.Item eventKey="report">Надіслати відгук</Dropdown.Item>
        </Dropdown>
      </Nav>
    </Navbar>
  );
};

export default TopBarUser;
