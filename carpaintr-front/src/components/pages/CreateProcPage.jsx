import TopBarUser from "../layout/TopBarUser";
import PageHeader from "../layout/PageHeader";
import ProcessorGenerator from "../editor/ProcessGenerator";

const CreateProcPage = () => {
  return (
    <div>
      <TopBarUser />
      <div
        className="fade-in-simple"
        style={{ margin: "0 auto", padding: "1em" }}
      >
        <PageHeader titleKey="Page header: Create processor" />
        <ProcessorGenerator />
      </div>
    </div>
  );
};

export default CreateProcPage;
