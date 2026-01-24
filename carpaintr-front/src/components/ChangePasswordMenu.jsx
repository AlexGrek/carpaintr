import { useState, useRef } from "react";
import { Form, Button, Schema, Message } from "rsuite";
import { authFetch } from "../utils/authFetch";

const { StringType } = Schema.Types;

const passwordModel = Schema.Model({
  currentPassword: StringType().isRequired(
    "Актуальний пароль має бути заповнено.",
  ),
  newPassword: StringType()
    .isRequired("Заповни новий пароль.")
    .minLength(6, "Пароль має бути не менше 6 символів у довжину."),
});

const ChangePassword = () => {
  const [formValue, setFormValue] = useState({
    currentPassword: "",
    newPassword: "",
  });
  const [formError, setFormError] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const formRef = useRef();

  const handleSubmit = async () => {
    if (!formRef.current.check()) {
      setMessage({ type: "error", body: "Заповніть форму коректно." });
      console.log("error");
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await authFetch("/api/v1/changepassword", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formValue),
      });

      console.log("sent req");

      if (response.ok) {
        setMessage({ type: "success", body: "Пароль успішно змінено!" });
        setFormValue({ currentPassword: "", newPassword: "" });
      } else {
        const errorData = await response.json();
        setMessage({
          type: "error",
          body: errorData.message || "Помилка зміни паролю.",
        });
      }
    } catch (error) {
      console.log("error:");
      console.log(error);
      setMessage({
        type: "error",
        body: "Помилка, перевірте введений пароль.",
      });
    } finally {
      console.log("finally");
      setLoading(false);
    }
  };

  return (
    <>
      {message && (
        <Message type={message.type} closable>
          {message.body}
        </Message>
      )}
      <Form
        model={passwordModel}
        formValue={formValue}
        onChange={setFormValue}
        onCheck={setFormError}
        ref={formRef}
      >
        <Form.Group controlId="currentPassword">
          <Form.ControlLabel>Старий пароль</Form.ControlLabel>
          <Form.Control
            name="currentPassword"
            type="password"
            placeholder="Старий пароль"
          />
        </Form.Group>

        <Form.Group controlId="newPassword">
          <Form.ControlLabel>Новий пароль</Form.ControlLabel>
          <Form.Control
            name="newPassword"
            type="password"
            placeholder="Новий пароль"
          />
        </Form.Group>

        <Form.Group>
          <Button appearance="primary" onClick={handleSubmit} loading={loading}>
            Змінити пароль
          </Button>
        </Form.Group>
      </Form>
    </>
  );
};

export default ChangePassword;
