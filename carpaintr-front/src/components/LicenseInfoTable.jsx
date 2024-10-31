import React from 'react';
import { Table, Button, Container } from 'rsuite';

const LicenseInfoTable = ({ companyInfo }) => {
  if (!companyInfo) {
    return <p>No company information available.</p>;
  }

  const { email, license, companyName, currentTime } = companyInfo;
  
  const licenseData = [
    {
      label: 'Is Active',
      value: license.IsActive ? 'Yes' : 'No',
    },
    {
      label: 'Ends Date',
      value: license.EndsDate,
    },
    {
      label: 'Licensed To',
      value: license.LicensedTo,
    },
    {
      label: 'Level',
      value: license.Level,
    },
  ];

  return (
    <Container>
      <h3>Company Information</h3>
      <Table data={licenseData} bordered>
        <Table.Column width={200} resizable>
          <Table.HeaderCell>Field</Table.HeaderCell>
          <Table.Cell dataKey="label" />
        </Table.Column>
        <Table.Column width={300} resizable>
          <Table.HeaderCell>Value</Table.HeaderCell>
          <Table.Cell dataKey="value" />
        </Table.Column>
      </Table>

      <div style={{ marginTop: '20px' }}>
        <h4>Additional Company Info</h4>
        <p><strong>Email:</strong> {email}</p>
        <p><strong>Company Name:</strong> {companyName}</p>
        <p><strong>Current Time:</strong> {currentTime}</p>
      </div>
    </Container>
  );
};

export default LicenseInfoTable;
