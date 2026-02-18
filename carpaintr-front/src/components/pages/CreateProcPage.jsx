import TopBarUser from "../layout/TopBarUser";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import ProcessorGenerator from "../editor/ProcessGenerator";

const CreateProcPage = () => {
  useDocumentTitle("Document title: Create processor");
  return (
    <div>
      <TopBarUser />
      <div
        className="fade-in-simple"
        style={{ margin: "0 auto", padding: "1em" }}
      >
        <ProcessorGenerator />
      </div>
    </div>
  );
};

export default CreateProcPage;
