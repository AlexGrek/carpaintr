import TopBarUser from "./TopBarUser";
import PageLoader from "./PageLoader";

export default function ComponentLoadingPage() {
    return <div>
        <div className="opacity-25"><TopBarUser /></div>
        <PageLoader />
    </div>;
}