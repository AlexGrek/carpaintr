import { createContext, useContext, useState, useCallback } from "react";
import { Modal, Button, Form, Input } from "rsuite";

// Create the context
const GlobalCallbacksContext = createContext();

// Custom hook for easy access
export const useGlobalCallbacks = () => useContext(GlobalCallbacksContext);

export const GlobalCallbacksProvider = ({ children }) => {
  const [showReportModal, setShowReportModal] = useState(false);
  const [formData, setFormData] = useState({ issue: "", email: "" });

  // Open the report issue modal
  const showReportIssueForm = useCallback(() => {
    setShowReportModal(true);
  }, []);

  // Handle form submission
  const handleSubmit = () => {
    console.log("Issue reported:", formData);
    // Add your API call or any logic here
    setShowReportModal(false);
    setFormData({ issue: "", email: "" }); // Reset form
  };

  // Handle form field change
  const handleFieldChange = (value, fieldName) => {
    setFormData((prev) => ({ ...prev, [fieldName]: value }));
  };

  return (
    <GlobalCallbacksContext.Provider value={{ showReportIssueForm }}>
      {children}

      {/* Modal for "Report Issue" */}
      <Modal show={showReportModal} onHide={() => setShowReportModal(false)}>
        <Modal.Header>
          <Modal.Title>Report an Issue</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form fluid>
            <Form.Stack>
              <div>
                <p>Email (optional)</p>
                <Input
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={(value) => handleFieldChange(value, "email")}
                  placeholder="Enter your email"
                />
              </div>
              <div>
                <p>Describe the Issue</p>
                <Input
                  as="textarea"
                  name="issue"
                  rows={5}
                  value={formData.issue}
                  onChange={(value) => handleFieldChange(value, "issue")}
                  placeholder="Describe the issue in detail"
                />
              </div>
            </Form.Stack>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={handleSubmit} appearance="primary">
            Submit
          </Button>
          <Button onClick={() => setShowReportModal(false)} appearance="subtle">
            Cancel
          </Button>
        </Modal.Footer>
      </Modal>
    </GlobalCallbacksContext.Provider>
  );
};
