import TopBarUser from "../layout/TopBarUser";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import Trans from "../../localization/Trans";

const WipPage = () => {
  useDocumentTitle("Document title: Under construction");
  return (
    <div>
      <TopBarUser />
      <div
        className="fade-in-simple"
        style={{ maxWidth: "800px", margin: "0 auto", padding: "1em" }}
      >
        <p>
          <Trans>Under construction</Trans>
        </p>
      </div>
    </div>
  );
};

export default WipPage;
