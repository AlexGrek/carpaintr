import TopBarUser from "../layout/TopBarUser";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";

const AboutUsPage = () => {
  useDocumentTitle("Document title: About us");
  return (
    <div>
      <TopBarUser />
      <div
        className="fade-in-simple"
        style={{ maxWidth: "800px", margin: "0 auto", padding: "1em" }}
      >
      </div>
    </div>
  );
};

export default AboutUsPage;
