import { useCallback, useEffect, useState } from "react";
import CarPaintEstimator from "../calc/CarpaintEstimator";
import TopBarUser from "../layout/TopBarUser";
import { useLocation, useNavigate } from "react-router-dom";

const CalcPage = () => {
  const [hasChanges, setHasChanges] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Function to handle navigation confirmation
  const confirmNavigation = useCallback(() => {
    if (hasChanges) {
      return window.confirm(
        "You have unsaved changes. Are you sure you want to leave this page? Your changes will be lost.",
      );
    }
    return true;
  }, [hasChanges]);

  // Handle browser back/forward buttons and page refresh
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = ""; // Chrome requires returnValue to be set
        return ""; // Some browsers require a return value
      }
    };

    const handlePopState = (e) => {
      if (hasChanges) {
        const shouldLeave = confirmNavigation();
        if (!shouldLeave) {
          // Push the current state back to prevent navigation
          window.history.pushState(null, "", location.pathname);
        }
      }
    };

    // Add event listeners
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("popstate", handlePopState);

    // Push initial state to handle back button
    window.history.pushState(null, "", location.pathname);

    // Cleanup
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [hasChanges, confirmNavigation, location.pathname]);

  // Custom navigation function that can be passed to child components
  const handleNavigation = useCallback(
    (path) => {
      if (confirmNavigation()) {
        navigate(path);
      }
    },
    [navigate, confirmNavigation],
  );

  return (
    <div>
      <TopBarUser onNavigate={handleNavigation} />
      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "1em" }}>
        <CarPaintEstimator setChanges={setHasChanges} />
      </div>
    </div>
  );
};

export default CalcPage;
