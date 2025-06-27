import { Placeholder } from "rsuite"
import TopBarUser from "../layout/TopBarUser"
import SupportRequestForm from "../admreq/SupportRequestForm";
import UserSupportRequests from "../admreq/UserSupportRequests";

const ContactSupport = () => {
    return <div><TopBarUser/><div className='fade-in-simple' style={{ maxWidth: '800px', margin: '0 auto', padding: '1em' }}>
        <SupportRequestForm/><UserSupportRequests/></div>
    </div>
}

export default ContactSupport;