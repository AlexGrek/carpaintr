import { Loader } from "rsuite";
import PlaceholderParagraph from "rsuite/esm/Placeholder/PlaceholderParagraph";

const PageLoader = () => {
  return (
    <div>
      <PlaceholderParagraph />
      <Loader size="md" speed="slow" center />
    </div>
  );
};

export default PageLoader;
