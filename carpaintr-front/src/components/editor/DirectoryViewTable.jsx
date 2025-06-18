import { Table } from 'rsuite';
import {
  File as FileIcon,
  Folder as FolderIcon,
  FileJson,
  FileText,
  FileSignature,
  FileSpreadsheet,
  ScrollText
} from 'lucide-react';

const { Column, HeaderCell, Cell } = Table;

function getFileType(filename) {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  switch (ext) {
    case 'json':
    case 'yaml':
    case 'yml':
      return 'Data Source';
    case 'csv':
      return 'Table';
    case 'txt':
    case 'md':
      return 'Text File';
    case 'jwt':
      return 'License';
    case 'log':
      return 'Log File';
    default:
      return 'File';
  }
}

function getIcon(node) {
  if (!node.isFile) return <FolderIcon size={18} />;
  const ext = node.label.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'json':
    case 'yaml':
    case 'yml':
      return <FileJson size={18} />;
    case 'csv':
      return <FileSpreadsheet size={18} />;
    case 'txt':
    case 'md':
      return <FileText size={18} />;
    case 'jwt':
      return <FileSignature size={18} />;
    case 'log':
      return <ScrollText size={18} />;
    default:
      return <FileIcon size={18} />;
  }
}

function renderNameWithExtension(label) {
  const dotIndex = label.lastIndexOf('.');
  if (dotIndex <= 0 || dotIndex === label.length - 1) return label;

  const name = label.slice(0, dotIndex);
  const ext = label.slice(dotIndex);

  return (
    <span>
      {name}
      <span style={{ color: '#999', fontSize: '0.85em' }}>{ext}</span>
    </span>
  );
}

export default function DirectoryViewTable({ value, onFileClick, onDirectoryClick }) {
  const data = value;

  return (
    <Table
      data={data}
      autoHeight
      bordered
      cellBordered
      style={{ width: '100%' }}
      rowHeight={50}
      hover
      onRowClick={(rowData) => {
        if (rowData.isFile) {
            console.log(rowData);
          onFileClick?.(rowData.value);
        } else {
          onDirectoryClick?.(rowData);
        }
      }}
    >
      <Column flexGrow={2} align="left" fixed>
        <HeaderCell>Name</HeaderCell>
        <Cell style={{'cursor': 'pointer', }}>
          {(rowData) => (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {getIcon(rowData)}
              {renderNameWithExtension(rowData.label)}
            </div>
          )}
        </Cell>
      </Column>

      <Column flexGrow={1} align="left">
        <HeaderCell>Type</HeaderCell>
        <Cell>
          {(rowData) =>
            rowData.isFile ? getFileType(rowData.label) : 'Directory'
          }
        </Cell>
      </Column>
    </Table>
  );
}
