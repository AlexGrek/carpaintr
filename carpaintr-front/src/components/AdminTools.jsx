import React, { useState } from 'react';
import { Tabs } from 'rsuite';
import CreateUser from './CreateUser';
import ManageUsers from './ManageUsers';

const AdminTools = () => {
    const [activeKey, setActiveKey] = useState('1'); // Default active tab is Create User

  return (
    <div style={{ marginTop: '20px' }}>
      <h4>Admin Tools</h4>
      <Tabs activeKey={activeKey} onSelect={setActiveKey} appearance='pills'>
        <Tabs.Tab eventKey="1" title="Create User">
            {activeKey === '1' && <CreateUser />}
        </Tabs.Tab>
        <Tabs.Tab eventKey="2" title="Manage Users">
          <ManageUsers />
        </Tabs.Tab>
        <Tabs.Tab eventKey="3" title="Logs">
          <ManageUsers />
        </Tabs.Tab>
        <Tabs.Tab eventKey="4" title="Tables">
          <ManageUsers />
        </Tabs.Tab>
      </Tabs>
    </div>
  );
};

export default AdminTools;
