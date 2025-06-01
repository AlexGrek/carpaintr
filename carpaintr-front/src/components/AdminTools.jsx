import React, { useState } from 'react';
import { Tabs, PanelGroup, Panel } from 'rsuite'; // Import PanelGroup and Panel
import { useMediaQuery } from 'react-responsive'; // Import useMediaQuery
import CreateUser from './CreateUser';
import ManageUsers from './ManageUsers';
import ServerLogs from './ServerLogs';

const AdminTools = () => {
    const [activeKey, setActiveKey] = useState('1'); // Default active tab is Create User
    const isMobile = useMediaQuery({ maxWidth: 767 }); // Define mobile breakpoint, e.g., 767px

  return (
    <div style={{ marginTop: '20px', width: "100%"}}>
      {isMobile ? (
        <PanelGroup accordion bordered>
          <Panel header="Додати користувача" eventKey="1" collapsible>
            <CreateUser />
          </Panel>
          <Panel header="Керування користувачами" eventKey="2" collapsible>
            <ManageUsers />
          </Panel>
          <Panel header="Логи" eventKey="3" collapsible>
            <ServerLogs />
          </Panel>
          <Panel header="Дані" eventKey="4" collapsible>
            <ManageUsers /> {/* Assuming "Дані" also uses ManageUsers */}
          </Panel>
        </PanelGroup>
      ) : (
        <Tabs className='fade-in-simple' activeKey={activeKey} onSelect={setActiveKey} appearance='pills'>
          <Tabs.Tab eventKey="1" title="Додати користувача" style={{"margin": "auto"}}>
              {activeKey === '1' && <CreateUser />}
          </Tabs.Tab>
          <Tabs.Tab eventKey="2" title="Керування користувачами">
            <ManageUsers />
          </Tabs.Tab>
          <Tabs.Tab eventKey="3" title="Логи">
            <ServerLogs />
          </Tabs.Tab>
          <Tabs.Tab eventKey="4" title="Дані">
            <ManageUsers />
          </Tabs.Tab>
        </Tabs>
      )}
    </div>
  );
};

export default AdminTools;