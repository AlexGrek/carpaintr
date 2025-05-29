import React, { useState } from 'react';
import { Tabs } from 'rsuite';
import CreateUser from './CreateUser';
import ManageUsers from './ManageUsers';

const AdminTools = () => {
    const [activeKey, setActiveKey] = useState('1'); // Default active tab is Create User

  return (
    <div style={{ marginTop: '20px', width: "100%"}}>
      <Tabs className='fade-in-simple' activeKey={activeKey} onSelect={setActiveKey} appearance='pills'>
        <Tabs.Tab eventKey="1" title="Додати користувача" style={{"margin": "auto"}}>
            {activeKey === '1' && <CreateUser />}
        </Tabs.Tab>
        <Tabs.Tab eventKey="2" title="Керування користувачами">
          <ManageUsers />
        </Tabs.Tab>
        <Tabs.Tab eventKey="3" title="Логи">
          <ManageUsers />
        </Tabs.Tab>
        <Tabs.Tab eventKey="4" title="Дані">
          <ManageUsers />
        </Tabs.Tab>
      </Tabs>
    </div>
  );
};

export default AdminTools;
