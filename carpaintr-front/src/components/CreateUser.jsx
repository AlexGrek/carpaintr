import { useState } from "react";
import { Input, InputGroup, Button, Form, Message } from "rsuite";
import { Eye, EyeOff } from "lucide-react";
import { authFetch } from "../utils/authFetch";

const CreateUser = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleCreateUser = async () => {
    if (password !== confirmPassword) {
      setError("Паролі не співпадають");
      return;
    }

    // Create user request
    try {
      const userResponse = await authFetch("/api/v1/admin/register", {
        method: "POST",
        body: JSON.stringify({ email, password }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!userResponse.ok) {
        const errorData = await userResponse.json();
        throw new Error(errorData.message || "Помилка");
      }

      // After user creation, create company info
      const companyInfo = {
        email,
        license: null, // Set license to null
        company_name: companyName,
        current_time: new Date().toISOString(),
      };

      const companyResponse = await authFetch(
        "/api/v1/admin/updatecompanyinfo",
        {
          method: "POST",
          body: JSON.stringify(companyInfo),
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      if (!companyResponse.ok) {
        const errorData = await companyResponse.json();
        throw new Error(
          errorData.message || "Помилка оновлення даних компанії",
        );
      }

      setSuccess(true);
      setError(null);
    } catch (error) {
      setError(error.message);
      setSuccess(false);
    }
  };

  return (
    <div>
      {error && (
        <Message type="error" showIcon>
          {error}
        </Message>
      )}
      {success && (
        <Message type="success" showIcon>
          Користувача створено успішно!
        </Message>
      )}
      <Form>
        <Form.Stack layout="vertical">
          <Form.Group controlId="email">
            <Form.ControlLabel>Електронна пошта</Form.ControlLabel>
            <Input type="email" value={email} onChange={setEmail} required />
          </Form.Group>
          <Form.Group controlId="password">
            <Form.ControlLabel>Пароль</Form.ControlLabel>
            <InputGroup inside>
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={setPassword}
                required
                data-testid="create-user-password-input"
              />
              <InputGroup.Button
                data-testid="create-user-password-toggle"
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </InputGroup.Button>
            </InputGroup>
          </Form.Group>
          <Form.Group controlId="confirmPassword">
            <Form.ControlLabel>Підтвердити пароль</Form.ControlLabel>
            <InputGroup inside>
              <Input
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={setConfirmPassword}
                required
                data-testid="create-user-confirm-password-input"
              />
              <InputGroup.Button
                data-testid="create-user-confirm-password-toggle"
                onClick={() => setShowConfirm((v) => !v)}
              >
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </InputGroup.Button>
            </InputGroup>
          </Form.Group>
          <Form.Group controlId="companyName">
            <Form.ControlLabel>Назва компанії</Form.ControlLabel>
            <Input value={companyName} onChange={setCompanyName} required />
          </Form.Group>
          <Button appearance="primary" onClick={handleCreateUser}>
            Створити
          </Button>
        </Form.Stack>
      </Form>
    </div>
  );
};

export default CreateUser;
