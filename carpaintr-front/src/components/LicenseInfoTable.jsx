import { Table, Container } from "rsuite";

const LicenseInfoTable = ({ companyInfo }) => {
  if (!companyInfo) {
    return (
      <p data-testid="company-info-empty">No company information available.</p>
    );
  }

  const email = companyInfo.email;
  const companyName =
    companyInfo.company_name ?? companyInfo.companyName ?? "";
  const currentTime = companyInfo.current_time ?? companyInfo.currentTime;
  const license = companyInfo.license;

  const licenseRows = [];
  if (license != null && typeof license === "object") {
    licenseRows.push(
      {
        label: "Is Active",
        value: license.IsActive ? "Yes" : "No",
      },
      { label: "Ends Date", value: license.EndsDate },
      { label: "Licensed To", value: license.LicensedTo },
      { label: "Level", value: license.Level },
    );
  } else if (license != null && license !== "") {
    licenseRows.push({ label: "License", value: String(license) });
  }

  return (
    <Container data-testid="company-info-table">
      <h3>Company Information</h3>
      {licenseRows.length > 0 && (
        <Table data={licenseRows} bordered>
          <Table.Column width={200} resizable>
            <Table.HeaderCell>Field</Table.HeaderCell>
            <Table.Cell dataKey="label" />
          </Table.Column>
          <Table.Column width={300} resizable>
            <Table.HeaderCell>Value</Table.HeaderCell>
            <Table.Cell dataKey="value" />
          </Table.Column>
        </Table>
      )}

      <div style={{ marginTop: "20px" }}>
        <h4>Additional Company Info</h4>
        {email != null && (
          <p>
            <strong>Email:</strong> {email}
          </p>
        )}
        {companyName !== "" && (
          <p>
            <strong>Company Name:</strong> {companyName}
          </p>
        )}
        {currentTime != null && (
          <p>
            <strong>Current Time:</strong> {String(currentTime)}
          </p>
        )}
      </div>
    </Container>
  );
};

export default LicenseInfoTable;
