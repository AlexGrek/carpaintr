import FilesystemBrowser from "../editor/FilesystemBrowser";

const filesystemConfigs = [
  {
    name: "User",
    listEndpoint: "editor/list_user_files",
    readEndpoint: "editor/read_user_file",
    validateEndpoint: "editor/validate_user_file",
    fixEndpoint: "editor/fix_user_file",
    uploadEndpoint: "editor/upload_user_file",
    deleteEndpoint: "editor/delete_user_file",
    historyEnabled: true,
  },
  {
    name: "Common",
    listEndpoint: "editor/list_common_files",
    readEndpoint: "editor/read_common_file",
    uploadEndpoint: "editor/upload_user_file",
    deleteEndpoint: "editor/delete_user_file",
  },
];

const DataCatalog = () => (
  <div data-testid="catalog-data-panel">
    <FilesystemBrowser filesystems={filesystemConfigs} />
  </div>
);

export default DataCatalog;
