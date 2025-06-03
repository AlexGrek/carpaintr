import React, { useState } from 'react';
import { Tabs, PanelGroup, Panel, Container } from 'rsuite';
import { useMediaQuery } from 'react-responsive';
import CreateUser from './CreateUser';
import ManageUsers from './ManageUsers';
import ServerLogs from './ServerLogs';
import AdminPanelRequests from './admreq/AdminPanelRequests';

const AdminTools = () => {
  const [activeKey, setActiveKey] = useState('1');
  const isMobile = useMediaQuery({ maxWidth: 767 });

  // Define a mapping of eventKeys to their corresponding components and titles
  const sections = [
    {
      eventKey: '1',
      title: 'Додати користувача',
      component: <CreateUser />
    },
    {
      eventKey: '2',
      title: 'Керування користувачами',
      component: <ManageUsers />
    },
    {
      eventKey: '3',
      title: 'Логи',
      component: <ServerLogs />
    },
    {
      eventKey: '4',
      title: 'Дані',
      component: <ManageUsers />
    },
    {
      eventKey: '5',
      title: 'Запити',
      component: <AdminPanelRequests />
    }
  ];

  return (
    <div style={{ marginTop: '20px', width: "100%" }}>
      {isMobile ? (
        <PanelGroup accordion bordered activeKey={activeKey} onSelect={setActiveKey}>
          {sections.map(section => (
            <Panel
              header={section.title}
              eventKey={section.eventKey}
              collapsible
              key={section.eventKey}
            >
              <Container>
                {section.component}
              </Container>
            </Panel>
          ))}
        </PanelGroup>
      ) : (
        <Tabs activeKey={activeKey} onSelect={setActiveKey} appearance='pills'>
          {sections.map(section => (
            <Tabs.Tab
              eventKey={section.eventKey}
              title={section.title}
              key={section.eventKey}
              style={section.eventKey === '1' ? { "margin": "auto" } : {}} // Apply specific style for the first tab
            >
              {activeKey === section.eventKey && section.component}
            </Tabs.Tab>
          ))}
        </Tabs>
      )}
    </div>
  );
};

export default AdminTools;