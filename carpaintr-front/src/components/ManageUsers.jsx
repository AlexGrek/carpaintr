import React, { useEffect, useState } from "react";
import { Button, ButtonGroup, Drawer, Input, Loader, Panel } from "rsuite";
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
  "Reset password": "Скинути пароль",
  "New password": "Новий пароль",
  Generate: "Згенерувати",
  "Set password": "Встановити пароль",
  "Password is required": "Пароль обов'язковий",
  "Manage licenses": "Керування ліцензіями",
  Impersonate: "Увійти як",
  Export: "Експорт",
  "Failed to export user data": "Не вдалося експортувати дані користувача",
});

const ManageUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [licenseEditorOpen, setLicenseEditorOpen] = useState(false);
  const [passwordResetOpen, setPasswordResetOpen] = useState(false);
  const [passwordResetUser, setPasswordResetUser] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState(null);
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

  const generateRandomPassword = () => {
    const chars =
      "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
    return Array.from(
      { length: 16 },
      () => chars[Math.floor(Math.random() * chars.length)],
    ).join("");
  };

  const handleOpenPasswordReset = (email) => {
    setPasswordResetUser(email);
    setNewPassword("");
    setPasswordError(null);
    setPasswordResetOpen(true);
  };

  const handlePasswordResetSubmit = async () => {
    if (!newPassword.trim()) {
      setPasswordError(str("Password is required"));
      return;
    }
    try {
      await handleChPassUser(passwordResetUser, newPassword);
      setPasswordResetOpen(false);
      setPasswordResetUser(null);
      setNewPassword("");
    } catch (err) {
      setPasswordError(err.message);
    }
  };

  const handlePasswordResetClose = () => {
    setPasswordResetOpen(false);
    setPasswordResetUser(null);
    setNewPassword("");
    setPasswordError(null);
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

  const handleExportUserData = async (email) => {
    try {
      setLoading(true);
      const encodedEmail = encodeURIComponent(email);
      const response = await authFetch(
        `/api/v1/admin/export_user_data/${encodedEmail}`
      );

      if (!response.ok) {
        throw new Error(str("Failed to export user data"));
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${email}-export.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
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
      <Drawer
        placement="top"
        open={passwordResetOpen}
        onClose={handlePasswordResetClose}
        data-testid="password-reset-drawer"
      >
        <Drawer.Header>
          <Trans>Reset password</Trans>
          {passwordResetUser && (
            <span style={{ marginLeft: 8, fontWeight: "normal", opacity: 0.7 }}>
              — {passwordResetUser}
            </span>
          )}
        </Drawer.Header>
        <Drawer.Body>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 16,
              maxWidth: 400,
              margin: "0 auto",
            }}
          >
            {passwordError && (
              <ErrorMessage errorText={passwordError} />
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <Input
                data-testid="password-reset-input"
                placeholder={str("New password")}
                value={newPassword}
                onChange={setNewPassword}
                style={{ flex: 1 }}
              />
              <Button
                data-testid="password-generate-button"
                onClick={() => setNewPassword(generateRandomPassword())}
              >
                <Trans>Generate</Trans>
              </Button>
            </div>
            <ButtonGroup>
              <Button
                data-testid="password-reset-submit-button"
                appearance="primary"
                onClick={handlePasswordResetSubmit}
              >
                <Trans>Set password</Trans>
              </Button>
              <Button
                data-testid="password-reset-cancel-button"
                onClick={handlePasswordResetClose}
              >
                <Trans>Cancel</Trans>
              </Button>
            </ButtonGroup>
          </div>
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
                data-testid={`change-password-button-${email}`}
                onClick={() => handleOpenPasswordReset(email)}
              >
                <Trans>Change password</Trans>
              </Button>
              <Button onClick={() => handleLicenseManagementClick(user)}>
                <Trans>Manage licenses</Trans>
              </Button>
              <Button onClick={() => handleImpersonateClick(user)}>
                <Trans>Impersonate</Trans>
              </Button>
              <Button onClick={() => handleExportUserData(email)}>
                <Trans>Export</Trans>
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
