import { useState } from "react";
import {
  Form,
  Button,
  Message,
  useToaster,
  Input,
  Container,
  Panel,
} from "rsuite";
import { useNavigate } from "react-router-dom";

const RegistrationPage = () => {
  // State for email, password, and loading status
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [invite, setInvite] = useState("");
  const [loading, setLoading] = useState(false);

  // rsuite toaster for displaying messages
  const toaster = useToaster();
  // react-router-dom hook for navigation
  const navigate = useNavigate();

  // Handler for the registration button click
  const handleRegistration = async () => {
    // Set loading state to true while the request is in progress
    setLoading(true);
    try {
      // Make a POST request to the registration API endpoint
      const response = await fetch("/api/v1/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Send email and password in the request body as JSON
        body: JSON.stringify({
          email: email,
          password: password,
          invite: invite,
        }),
      });

      // Check if the response was successful (status code 2xx)
      if (!response.ok) {
        // If not successful, parse the error response and throw an error
        const errorData = await response.json();
        throw new Error(
          errorData.message || "Registration failed. Please try again.",
        );
      }

      // If registration is successful, display a success message
      toaster.push(
        <Message type="success" header="Success">
          Registration successful! You can now log in.
        </Message>,
        { placement: "topCenter" },
      );
      // Navigate the user to the login page after successful registration
      navigate("/app/login");
    } catch (error) {
      // Catch any errors during the fetch request or response handling
      // Display an error message using the toaster
      toaster.push(
        <Message type="error" header="Error">
          {error.message}
        </Message>,
        { placement: "topCenter" },
      );
    } finally {
      // Set loading state back to false after the request is complete ( चाहे success हो या failure)
      setLoading(false);
    }
  };

  return (
    // Container to center the form on the page
    <Container className="auth-page">
      {/* Panel to give a bordered look to the form area */}
      <Panel
        className="fade-in-simple"
        style={{
          maxWidth: 400,
          margin: "auto",
          padding: "2rem",
          marginTop: "8em",
          backgroundColor: "white",
        }}
        bordered
      >
        {/* rsuite Form component with fluid layout */}
        <Form fluid>
          <img
            src="/autolab_large_bw.png"
            alt="CarPaintr Logo"
            height="200pt"
          />
          {/* Form group for the email input */}
          <Form.Group>
            <Form.ControlLabel>Електронна адреса</Form.ControlLabel>
            {/* Input field for email, controlled by state */}
            <Input value={email} onChange={(value) => setEmail(value)} />
          </Form.Group>
          {/* Form group for the password input */}
          <Form.Group>
            <Form.ControlLabel>Пароль</Form.ControlLabel>
            {/* Input field for password, type="password" to mask input */}
            <Input
              type="password"
              value={password}
              onChange={(value) => setPassword(value)}
            />
          </Form.Group>
          <Form.Group>
            <Form.ControlLabel>
              Код запрошення (необов'язково)
            </Form.ControlLabel>
            {/* Input field for password, type="password" to mask input */}
            <Input value={invite} onChange={(value) => setInvite(value)} />
          </Form.Group>
          {/* Form group for the registration button */}
          <Form.Group>
            {/* Button to trigger the registration process */}
            <Button
              appearance="primary"
              onClick={handleRegistration}
              loading={loading}
            >
              Зареєструватися
            </Button>
          </Form.Group>
        </Form>
      </Panel>
    </Container>
  );
};

export default RegistrationPage;
