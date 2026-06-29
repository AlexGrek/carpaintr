import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import TopBarUser from "../layout/TopBarUser";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import FilesystemBrowser from "../editor/FilesystemBrowser";
import { useActiveLicense } from "../../hooks/useActiveLicense";
import { redirectToLicenseStatus } from "../../utils/licenseRedirect";
import ComponentLoadingPage from "../layout/ComponentLoadingPage";

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
    uploadEndpoint: "editor/upload_user_file", // Changes to common files create a copy in user directory
    deleteEndpoint: "editor/delete_user_file", // Deleting common files deletes the user copy
  },
];

const FileEditorPage = () => {
  useDocumentTitle("Document title: Data Editor");
  const navigate = useNavigate();
  const { licenseStatus, loading } = useActiveLicense();

  useEffect(() => {
    if (!loading && licenseStatus && !licenseStatus.has_active_license) {
      redirectToLicenseStatus(navigate);
    }
  }, [loading, licenseStatus, navigate]);

  if (loading) return <ComponentLoadingPage />;
  if (!licenseStatus?.has_active_license) return null;

  return (
    <div data-testid="fileeditor-page">
      <TopBarUser />
      <div
        className="fade-in-simple"
        style={{ maxWidth: "800px", margin: "0 auto", padding: "1em" }}
      >
        <FilesystemBrowser filesystems={filesystemConfigs} />
      </div>
    </div>
  );
};

export default FileEditorPage;
