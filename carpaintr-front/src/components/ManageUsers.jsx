import React, { useEffect, useState } from 'react';
import { Button, ButtonGroup, Drawer, Panel } from 'rsuite';
import { authFetch } from '../utils/authFetch';
import ReloadIcon from '@rsuite/icons/Reload';
import LicenseManager from './LicenseManager';

const DisplayUserData = ({ data }) => {
  const formatDate = (dateString) => {
    if (!dateString) return 'Not set';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <div className="p-4">
      <table className="w-full">
        <tbody>
          <tr>
            <td className="font-bold pr-4 py-2">ID:</td>
            <td>{data.ID}</td>
          </tr>
          <tr>
            <td className="font-bold pr-4 py-2">Created At:</td>
            <td>{formatDate(data.CreatedAt)}</td>
          </tr>
          <tr>
            <td className="font-bold pr-4 py-2">Updated At:</td>
            <td>{formatDate(data.UpdatedAt)}</td>
          </tr>
          <tr>
            <td className="font-bold pr-4 py-2">Deleted At:</td>
            <td>{data.DeletedAt ? formatDate(data.DeletedAt) : 'Never'}</td>
          </tr>
          <tr>
            <td className="font-bold pr-4 py-2">Email:</td>
            <td>{data.Email}</td>
          </tr>
          <tr>
            <td className="font-bold pr-4 py-2">Password:</td>
            <td>{data.Password ? '********' : 'Not set'}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

const ManageUsers = () => {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [licenseEditorOpen, setLicenseEditorOpen] = useState(false);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [confirmationFunc, setConfirmationFunc] = useState(null);
  const [confirmationText, setConfirmationText] = useState(null);
  const [editingUser, setEditingUser] = useState(null);

  const withConfirmation = (user, text, func) => {
    setEditingUser(user)
    setConfirmationText(text)
    console.log("With confirmation func:")
    console.log(func)
    setConfirmationFunc(() => func)
    setConfirmationOpen(true)
    console.log("WithConfirmation called")
  }

  const fetchData = async () => {
    try {
      const response = await authFetch('/api/v1/admin/listusers');
      if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
      }
      const data = await response.json();
      setUsers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const sendManagementRequest = async (body) => {
    console.log("Management request: ", JSON.stringify(body))
    const resp = await authFetch('/api/v1/admin/manageuser', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!resp.ok) {
      const errorData = await resp.json();
      setError(errorData);
      throw new Error(errorData.message || 'Failed to send management request');
    }
  }

  const handleDeleteUser = async (user) => {
    console.log("DELETE USER NOW!")
    const managementRequest = {
      "action": "delete",
      "email": user
    }

    await sendManagementRequest(managementRequest)
    await fetchData()
  }

  const handleChPassUser = async (user, password) => {
    const managementRequest = {
      "action": "change_pass",
      "email": user,
      "data": password
    }

    await sendManagementRequest(managementRequest)
  }

  const handleLicenseManagementClick = (user) => {
    setEditingUser(user)
    setLicenseEditorOpen(true)
  }

  const handleLicenseEditorClose = () => {
    setEditingUser(null)
    setLicenseEditorOpen(false)
  }

  const handleOnConfirmationClick = async () => {
    console.log("Confirmed: ", confirmationText)
    console.log(confirmationFunc)
    await confirmationFunc()
    setConfirmationOpen(false)
    setConfirmationFunc(null)
  }

  const handleOnConfirmationCancel = () => {
    setConfirmationOpen(false)
    setConfirmationFunc(null)
  }

  return (
    <div>
      <Drawer open={licenseEditorOpen} onClose={handleLicenseEditorClose}>
        <Drawer.Header>
          {editingUser}
        </Drawer.Header>
        <Drawer.Body>
          {editingUser && <div>
            <p>License management stuff</p>
            <LicenseManager userEmail={editingUser}/>
          </div>}
        </Drawer.Body>
      </Drawer>
      <Drawer placement="top" open={confirmationOpen} onClose={() => setConfirmationOpen(false)}>
        <Drawer.Header>
          Підтвердити
        </Drawer.Header>
        <Drawer.Body>
          {editingUser && <div style={{ width: "100%", "display": "flex", flexDirection: "column", alignItems: "center", height: "100%", "justifyContent": "space-evenly" }}>
            <p>{confirmationText}: <mark>{editingUser.Email}</mark></p>
            <ButtonGroup>
              <Button onClick={handleOnConfirmationClick} appearance='primary'>Підтвердити</Button>
              <Button onClick={handleOnConfirmationCancel}>Скасувати</Button>
            </ButtonGroup>
          </div>}
        </Drawer.Body>
      </Drawer>
      <p>Користувачі в системі <Button startIcon={<ReloadIcon />} onClick={fetchData}> Оновити </Button></p>
      {users.map(user => {
        const email = user
        return <Panel bordered collapsible key={email} header={email}>
          {/* <DisplayUserData data={user} /> */}
          <ButtonGroup>
            <Button onClick={() => withConfirmation(user, "Видалити користувача", async () => handleDeleteUser(email))}>Видалити</Button>
            <Button onClick={() => handleChPassUser(email, "temporary_password_42")}>Змінити пароль</Button>
            <Button onClick={() => handleLicenseManagementClick(user)}>Керування ліцензіями</Button>
          </ButtonGroup>
          {/* <code>{JSON.stringify(user)}</code> */}
        </Panel>
      })}
    </div>
  );
};

export default ManageUsers;
