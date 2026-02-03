import React, { useEffect, useState } from "react";
import { Button, ButtonGroup, Drawer, Loader, Panel } from "rsuite";
import { authFetch, resetCompanyInfo } from "../utils/authFetch";
import ReloadIcon from "@rsuite/icons/Reload";
import LicenseManager from "./LicenseManager";
import Trans from "../localization/Trans"; // Import Trans component
import { useLocale, registerTranslations } from "../localization/LocaleContext"; // Import useLocale and registerTranslations
import { useNavigate } from "react-router-dom";
import ErrorMessage from "./layout/ErrorMessage";

registerTranslations("ua", {
  "Not set": "Не встановлено",
  Never: "Ніколи",
  "ID:": "ID:",
  "Created At:": "Створено:",
  "Updated At:": "Оновлено:",
  "Deleted At:": "Видалено:",
  "Email:": "Електронна пошта:",
  "Password:": "Пароль:",
  "Error: ": "Помилка: ",
  "Failed to send management request": "Не вдалося відправити запит",
  Confirm: "Підтвердити",
  Cancel: "Скасувати",
  "Users in system": "Користувачі в системі",
  Refresh: "Оновити",
  "Delete user": "Видалити користувача",
  Delete: "Видалити",
  "Change password": "Змінити пароль",
  "Manage licenses": "Керування ліцензіями",
  Impersonate: "Увійти як",
});

const ManageUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [licenseEditorOpen, setLicenseEditorOpen] = useState(false);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [confirmationFunc, setConfirmationFunc] = useState(null);
  const [confirmationText, setConfirmationText] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const { str } = useLocale();
  const navigate = useNavigate();

  const withConfirmation = (user, text, func) => {
    setEditingUser(user);
    setConfirmationText(text);
    console.log("With confirmation func:");
    console.log(func);
    setConfirmationFunc(() => func);
    setConfirmationOpen(true);
    console.log("WithConfirmation called");
  };

  const handleImpersonation = async (req) => {
    setLoading(true);
    try {
      const response = await authFetch("/api/v1/admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
      });

      if (response.status === 401 || response.status === 403) {
        throw new Error("Unauthorized: ", response.status);
      }

      if (!response.ok) throw new Error("Login failed. Please try again.");

      const data = await response.json();
      if (data.token) {
        localStorage.setItem("authToken", data.token); // Store the token in localStorage
        resetCompanyInfo();
        navigate("/app/dashboard");
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchData = React.useCallback(async () => {
    try {
      const response = await authFetch("/api/v1/admin/listusers");
      if (!response.ok) {
        throw new Error(`${str("Error: ")}${response.statusText}`);
      }
      const data = await response.json();
      setUsers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [str]);

  useEffect(() => {
    fetchData();
  }, [fetchData, str]);

  const sendManagementRequest = async (body) => {
    console.log("Management request: ", JSON.stringify(body));
    const resp = await authFetch("/api/v1/admin/manageuser", {
      method: "POST",
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!resp.ok) {
      const errorData = await resp.json();
      setError(errorData);
      throw new Error(
        errorData.message || str("Failed to send management request"),
      );
    }
  };

  const handleDeleteUser = async (user) => {
    console.log("DELETE USER NOW!");
    const managementRequest = {
      action: "delete",
      email: user,
    };

    await sendManagementRequest(managementRequest);
    await fetchData();
  };

  const handleChPassUser = async (user, password) => {
    const managementRequest = {
      action: "change_pass",
      email: user,
      data: password,
    };

    await sendManagementRequest(managementRequest);
  };

  const handleLicenseManagementClick = (user) => {
    setEditingUser(user);
    setLicenseEditorOpen(true);
  };

  const handleImpersonateClick = async (user) => {
    const managementRequest = {
      action: "impersonate",
      email: user,
    };

    await handleImpersonation(managementRequest);
  };

  const handleLicenseEditorClose = () => {
    setEditingUser(null);
    setLicenseEditorOpen(false);
  };

  const handleOnConfirmationClick = async () => {
    console.log("Confirmed: ", confirmationText);
    console.log(confirmationFunc);
    await confirmationFunc();
    setConfirmationOpen(false);
    setConfirmationFunc(null);
  };

  const handleOnConfirmationCancel = () => {
    setConfirmationOpen(false);
    setConfirmationFunc(null);
  };

  return (
    <div>
      <ErrorMessage errorText={error} />
      {loading && <Loader />}
      <Drawer
        open={licenseEditorOpen}
        onClose={handleLicenseEditorClose}
        size={"full"}
      >
        <Drawer.Header>{editingUser}</Drawer.Header>
        <Drawer.Body>
          {editingUser && (
            <div>
              <LicenseManager userEmail={editingUser} />
            </div>
          )}
        </Drawer.Body>
      </Drawer>
      <Drawer
        placement="top"
        open={confirmationOpen}
        onClose={() => setConfirmationOpen(false)}
      >
        <Drawer.Header>
          <Trans>Confirm</Trans>
        </Drawer.Header>
        <Drawer.Body>
          {editingUser && (
            <div
              style={{
                width: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                height: "100%",
                justifyContent: "space-evenly",
              }}
            >
              <p>
                {str(confirmationText)}: <mark>{editingUser.Email}</mark>
              </p>
              <ButtonGroup>
                <Button
                  onClick={handleOnConfirmationClick}
                  appearance="primary"
                >
                  <Trans>Confirm</Trans>
                </Button>
                <Button onClick={handleOnConfirmationCancel}>
                  <Trans>Cancel</Trans>
                </Button>
              </ButtonGroup>
            </div>
          )}
        </Drawer.Body>
      </Drawer>
      <p>
        <Trans>Users in system</Trans>{" "}
        <Button startIcon={<ReloadIcon />} onClick={fetchData}>
          {" "}
          <Trans>Refresh</Trans>{" "}
        </Button>
      </p>
      {users.map((user) => {
        const email = user;
        return (
          <Panel bordered collapsible key={email} header={email}>
            <ButtonGroup>
              <Button
                onClick={() =>
                  withConfirmation(user, str("Delete user"), async () =>
                    handleDeleteUser(email),
                  )
                }
              >
                <Trans>Delete</Trans>
              </Button>
              <Button
                onClick={() => handleChPassUser(email, "temporary_password_42")}
              >
                <Trans>Change password</Trans>
              </Button>
              <Button onClick={() => handleLicenseManagementClick(user)}>
                <Trans>Manage licenses</Trans>
              </Button>
              <Button onClick={() => handleImpersonateClick(user)}>
                <Trans>Impersonate</Trans>
              </Button>
            </ButtonGroup>
            {/* <code>{JSON.stringify(user)}</code> */}
          </Panel>
        );
      })}
    </div>
  );
};

export default ManageUsers;
