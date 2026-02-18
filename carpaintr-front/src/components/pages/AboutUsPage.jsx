import TopBarUser from "../layout/TopBarUser";
import PageHeader from "../layout/PageHeader";

const AboutUsPage = () => {
  return (
    <div>
      <TopBarUser />
      <div
        className="fade-in-simple"
        style={{ maxWidth: "800px", margin: "0 auto", padding: "1em" }}
      >
        <PageHeader titleKey="Page header: About us" />
      </div>
    </div>
  );
};

export default AboutUsPage;
