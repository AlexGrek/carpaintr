import TopBarUser from "../layout/TopBarUser";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import SupportRequestForm from "../admreq/SupportRequestForm";
import UserSupportRequests from "../admreq/UserSupportRequests";

const ContactSupport = () => {
  useDocumentTitle("Document title: Contact Support");
  return (
    <div>
      <TopBarUser />
      <div
        className="fade-in-simple"
        style={{ maxWidth: "800px", margin: "0 auto", padding: "1em" }}
      >
        <SupportRequestForm />
        <UserSupportRequests />
      </div>
    </div>
  );
};

export default ContactSupport;
