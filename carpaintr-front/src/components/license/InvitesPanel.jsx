import React, { useState, useEffect, useRef } from "react";
import {
  Container,
  Content,
  Header,
  FlexboxGrid,
  Panel,
  Button,
  Form,
  Radio,
  RadioGroup,
  InputNumber,
  Loader,
  Table,
  ButtonToolbar,
  Schema,
  Message,
  Tag,
  Stat,
  HStack,
} from "rsuite";
import { authFetch, authFetchJson } from "../../utils/authFetch";

// RSuite Table Components
const { Column, HeaderCell, Cell } = Table;

// Schema for form validation
const { StringType, NumberType } = Schema.Types;
const model = Schema.Model({
  evaluation_license_type: StringType().isRequired("License type is required."),
  evaluation_license_duration_days: NumberType(
    "Duration must be a number.",
  ).isRequired("Duration is required."),
  usage_policy: StringType().isRequired("Usage policy is required."),
  usage_limit: NumberType("Limit must be a number.").min(
    1,
    "Limit must be at least 1.",
  ),
});

const API = {
  list: "/api/v1/admin/invite/list",
  generate: "/api/v1/admin/invite/generate",
};

function InvitesPanel() {
  const [activeInvites, setActiveInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [generatedInvite, setGeneratedInvite] = useState(null);
  const [formValue, setFormValue] = useState({
    evaluation_license_type: "Basic",
    evaluation_license_duration_days: 14,
    issued_by: "",
    usage_policy: "UseOnce",
    usage_limit: 1,
  });
  const [formError, setFormError] = useState({});
  const formRef = useRef();

  // Fetch active invites on component mount
  useEffect(() => {
    const fetchInvites = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await authFetchJson(API.list);
        setActiveInvites(response);
        // Alert.success('Active invites loaded successfully!');
      } catch (err) {
        setError("Failed to fetch active invites.");
        // Alert.error('Failed to fetch active invites.');
      } finally {
        setLoading(false);
      }
    };

    fetchInvites();
  }, []);

  const handleGenerate = async () => {
    if (!formRef.current.check()) {
      return;
    }

    setLoading(true);
    setError(null);
    setGeneratedInvite(null);

    // Build the request body from form data
    const requestBody = {
      evaluationLicenseType: formValue.evaluation_license_type,
      evaluationLicenseDurationDays: parseInt(
        formValue.evaluation_license_duration_days,
      ),
      usagePolicy:
        formValue.usage_policy === "UseUpToCertainLimit"
          ? { UseUpToCertainLimit: parseInt(formValue.usage_limit) }
          : formValue.usage_policy,
    };

    try {
      const newInviteReq = await authFetch(API.generate, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (newInviteReq.ok) {
        const newInvite = await newInviteReq.json();
        setGeneratedInvite(newInvite);
        setActiveInvites([...activeInvites, newInvite]);
        // Alert.success('Invite generated successfully!');
      } else {
        throw Error(await newInviteReq.text());
      }
    } catch (err) {
      setError("Failed to generate invite: " + err.message);
      // Alert.error('Failed to generate invite.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container style={{ padding: "20px" }}>
      <Content>
        <FlexboxGrid justify="center">
          <FlexboxGrid.Item colspan={12}>
            <Panel header={<h3>Generate New Invite</h3>} bordered>
              <Form
                ref={formRef}
                formValue={formValue}
                onChange={setFormValue}
                onCheck={setFormError}
                model={model}
                fluid
              >
                <Form.Group controlId="evaluation_license_type">
                  <Form.ControlLabel>License Type</Form.ControlLabel>
                  <Form.Control
                    name="evaluation_license_type"
                    defaultValue="Basic"
                  />
                  <Form.HelpText>e.g., Basic, Pro, Enterprise</Form.HelpText>
                </Form.Group>

                <Form.Group controlId="evaluation_license_duration_days">
                  <Form.ControlLabel>Duration (Days)</Form.ControlLabel>
                  <Form.Control
                    name="evaluation_license_duration_days"
                    accepter={InputNumber}
                    min={1}
                  />
                </Form.Group>

                <Form.Group controlId="usage_policy">
                  <Form.ControlLabel>Usage Policy</Form.ControlLabel>
                  <Form.Control
                    name="usage_policy"
                    accepter={RadioGroup}
                    inline
                  >
                    <Radio value="UseOnce">UseOnce</Radio>
                    <Radio value="UseForever">UseForever</Radio>
                    <Radio value="UseUpToCertainLimit">
                      UseUpToCertainLimit
                    </Radio>
                  </Form.Control>
                </Form.Group>

                {formValue.usage_policy === "UseUpToCertainLimit" && (
                  <Form.Group controlId="usage_limit">
                    <Form.ControlLabel>Usage Limit</Form.ControlLabel>
                    <Form.Control
                      name="usage_limit"
                      accepter={InputNumber}
                      min={1}
                    />
                  </Form.Group>
                )}

                <Form.Group>
                  <ButtonToolbar>
                    <Button
                      appearance="primary"
                      onClick={handleGenerate}
                      disabled={loading}
                    >
                      {loading ? <Loader /> : "Generate Invite"}
                    </Button>
                  </ButtonToolbar>
                </Form.Group>
              </Form>
              {generatedInvite && (
                <Panel
                  header={<h4>Generated Invite</h4>}
                  bordered
                  shaded
                  style={{ marginTop: "20px" }}
                  className="fade-in-simple"
                >
                  <HStack alignItems="center" justifyContent="space-evenly">
                    <Stat>
                      <Stat.Label>Code</Stat.Label>
                      <Stat.Value>{generatedInvite.code}</Stat.Value>
                    </Stat>
                    <Stat>
                      <Stat.Label>Usage</Stat.Label>
                      <Stat.Value>
                        {JSON.stringify(generatedInvite.usagePolicy)}
                      </Stat.Value>
                    </Stat>
                  </HStack>
                </Panel>
              )}
            </Panel>
          </FlexboxGrid.Item>
        </FlexboxGrid>

        <hr style={{ margin: "40px 0" }} />

        <FlexboxGrid justify="center">
          <FlexboxGrid.Item colspan={20}>
            <Panel
              header={<h3>Active Invites</h3>}
              bordered
              collapsible
              style={{ backgroundColor: "white" }}
            >
              {loading ? (
                <Loader center content="Loading..." />
              ) : error ? (
                <Message type="error">{error}</Message>
              ) : (
                <Table
                  data={activeInvites}
                  autoHeight
                  bordered
                  cellBordered
                  virtualized
                  resizable
                >
                  <Column width={100} fixed>
                    <HeaderCell>Code</HeaderCell>
                    <Cell dataKey="code" />
                  </Column>
                  <Column width={250}>
                    <HeaderCell>Issued By</HeaderCell>
                    <Cell dataKey="issuedBy" />
                  </Column>
                  <Column width={120}>
                    <HeaderCell>License Type</HeaderCell>
                    <Cell dataKey="evaluationLicenseType" />
                  </Column>
                  <Column width={110}>
                    <HeaderCell>Duration (Days)</HeaderCell>
                    <Cell dataKey="evaluationLicenseDurationDays" />
                  </Column>
                  <Column width={160}>
                    <HeaderCell>Usage Policy</HeaderCell>
                    <Cell>
                      {(rowData) => {
                        if (rowData.usagePolicy == "UseOnce") return "Once";
                        if (rowData.usagePolicy == "UseForever")
                          return "Forever";
                        if (rowData.usagePolicy.UseUpToCertainLimit)
                          return `Use Up To ${rowData.usagePolicy.UseUpToCertainLimit}`;
                        return "N/A";
                      }}
                    </Cell>
                  </Column>
                  <Column width={150}>
                    <HeaderCell>Issued Date</HeaderCell>
                    <Cell>
                      {(rowData) =>
                        new Date(rowData.issued).toLocaleDateString()
                      }
                    </Cell>
                  </Column>
                  <Column width={150}>
                    <HeaderCell>Used By Count</HeaderCell>
                    <Cell>{(rowData) => rowData.usedBy.length}</Cell>
                  </Column>
                  <Column flexGrow={1}>
                    <HeaderCell>Used By</HeaderCell>
                    <Cell>{(rowData) => rowData.usedBy.join(", ")}</Cell>
                  </Column>
                </Table>
              )}
            </Panel>
          </FlexboxGrid.Item>
        </FlexboxGrid>
      </Content>
    </Container>
  );
}

export default InvitesPanel;
