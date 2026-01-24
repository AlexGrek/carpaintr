import {
  useState,
  useEffect,
  Suspense,
  useMemo,
  useCallback,
} from "react";
import { Button, Loader } from "rsuite";
import { ChevronLeft } from "lucide-react";
import { useLocale } from "../../localization/LocaleContext";

// --- RSuite Color Palette (for inline styles) ---
// These CSS variables are available because we import the RSuite stylesheet.
const rsuiteColors = {
  primary: "var(--rs-primary-500)",
  primaryHover: "var(--rs-primary-600)",
  textPrimary: "var(--rs-text-primary)",
  textSecondary: "var(--rs-text-secondary)",
  textDisabled: "var(--rs-text-disabled)",
  bgActive: "var(--rs-bg-active)",
  border: "var(--rs-border-primary)",
  subtle: "var(--rs-btn-subtle-bg)",
};

// --- STYLES ---
export const styles = {
  stageViewContainer: {
    fontFamily: "sans-serif",
    width: "100%",
  },
  navBar: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "3px 0",
    marginBottom: "20px",
    borderBottom: `1px solid ${rsuiteColors.border}`,
    gap: "8px",
  },
  navButton: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  stageContent: {
    width: "100%",
  },
  sampleStage: {
    // padding: '10px',
    textAlign: "center",
    // border: `1px dashed ${rsuiteColors.border}`,
    // borderRadius: '8px',
    margin: "0 auto",
    width: "100%",
    maxWidth: "500pt",
  },
  sampleStageInner: {
    transition: "opacity 200ms ease-in-out",
  },
  buttonGroup: {
    display: "flex",
    gap: "10px",
    justifyContent: "center",
    marginTop: "16px",
  },
};

/**
 * Utility functions for URL parameter management
 */
const getUrlParams = () => {
  return new URLSearchParams(window.location.search);
};

const updateUrlParam = (key, value) => {
  const url = new URL(window.location);
  if (value === null || value === undefined) {
    url.searchParams.delete(key);
  } else {
    url.searchParams.set(key, value);
  }
  window.history.pushState({}, "", url);
};

const replaceUrlParam = (key, value) => {
  const url = new URL(window.location);
  if (value === null || value === undefined) {
    url.searchParams.delete(key);
  } else {
    url.searchParams.set(key, value);
  }
  window.history.replaceState({}, "", url);
};

/**
 * StageView Component
 * * Manages a multi-stage process with a navigation bar and content switching.
 * @param {object} props
 * @param {Array<object>} props.stages - Configuration for each stage.
 * - name: {string} Unique identifier.
 * - title: {string} Display title.
 * - icon: {React.ElementType} Optional icon component.
 * - component: {React.ElementType} The component to render for the stage.
 * @param {number} [props.animationDelay=200] - The fade-out animation delay in ms.
 * @param {object} [props.initialState={}] - The initial shared state for all stages.
 */
function StageView({
  stages,
  initialState = {},
  animationDelay = 100,
  onSave = null,
}) {
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [stageData, setStageDataState] = useState(initialState);
  const { str } = useLocale();

  // Get initial stage from URL or default to 0
  const getStageFromUrl = () => {
    const params = getUrlParams();
    const stageParam = params.get("stage");

    if (stageParam) {
      // Try to find by name first
      const stageByName = stages.findIndex((s) => s.name === stageParam);
      if (stageByName !== -1) {
        return stageByName;
      }

      // Try to parse as index
      const stageIndex = parseInt(stageParam, 10);
      if (!isNaN(stageIndex) && stageIndex >= 0 && stageIndex < stages.length) {
        return stageIndex;
      }
    }

    return 0;
  };

  const [activeStageIndex, setActiveStageIndex] = useState(getStageFromUrl);
  const [previousStageIndex, setPreviousStageIndex] = useState(null);

  // Initialize state for each stage, enabling stages up to the current one
  const [stagesState, setStagesState] = useState(() =>
    stages.map((stage, index) => ({
      ...stage,
      enabled: index <= activeStageIndex,
    })),
  );

  // Effect to handle URL changes (including back/forward buttons)
  useEffect(() => {
    const handlePopState = () => {
      const newStageIndex = getStageFromUrl();
      if (newStageIndex !== activeStageIndex) {
        handleMoveToInternal(newStageIndex, { skipUrlUpdate: true });
      }
    };

    // Set initial URL if no stage parameter exists
    const params = getUrlParams();
    if (!params.has("stage")) {
      replaceUrlParam("stage", stages[0].name);
    }

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [stages, activeStageIndex]);

  /**
   * Updates the shared state. Merges new data with existing data.
   * @param {object} newData - The new data to merge into the state.
   */
  const handleSetStageData = (newData) => {
    setStageDataState((prevData) => {
      const updated = { ...prevData, ...newData };
      if (onSave != null) {
        onSave(updated);
      }
      return updated;
    });
  };

  const handleMoveToInternal = useCallback(
    (targetIndex, { skipUrlUpdate = false, isMovingForward = false } = {}) => {
      if (
        isFadingOut ||
        targetIndex === activeStageIndex ||
        targetIndex < 0 ||
        targetIndex >= stages.length
      ) {
        return;
      }

      // Check if target stage is enabled (allow moving to any previous stage or the next stage)
      if (
        !stagesState[targetIndex]?.enabled &&
        targetIndex > activeStageIndex + 1
      ) {
        return;
      }

      setIsFadingOut(true);

      setTimeout(() => {
        setPreviousStageIndex(activeStageIndex);
        setActiveStageIndex(targetIndex);

        // Enable stages up to the target if moving forward
        if (isMovingForward || targetIndex > activeStageIndex) {
          setStagesState((prev) => {
            const newState = [...prev];
            for (let i = 0; i <= targetIndex; i++) {
              if (newState[i]) {
                newState[i].enabled = true;
              }
            }
            return newState;
          });
        }

        // Update URL with stage name
        if (!skipUrlUpdate) {
          updateUrlParam("stage", stages[targetIndex].name);
        }

        setIsFadingOut(false);
      }, animationDelay);
    },
    [activeStageIndex, animationDelay, isFadingOut, stages, stagesState],
  );

  const handleMoveTo = (targetIndex) => {
    if (!stagesState[targetIndex]?.enabled) {
      return;
    }
    handleMoveToInternal(targetIndex);
  };

  const handleMoveForward = () => {
    const nextIndex = activeStageIndex + 1;
    if (nextIndex < stages.length) {
      handleMoveToInternal(nextIndex, { isMovingForward: true });
    }
  };

  const handleMoveBack = () => {
    if (activeStageIndex > 0) {
      handleMoveToInternal(activeStageIndex - 1);
    }
  };

  const handleMoveToByNameOrIndex = (identifier) => {
    const targetIndex =
      typeof identifier === "number"
        ? identifier
        : stages.findIndex((s) => s.name === identifier);

    if (targetIndex !== -1) {
      handleMoveTo(targetIndex);
    }
  };

  const { component: ActiveComponent, ...activeStageProps } = useMemo(
    () => stages[activeStageIndex] || stages[0],
    [activeStageIndex, stages],
  );

  return (
    <div style={styles.stageViewContainer}>
      <nav style={styles.navBar}>
        <Button
          onClick={handleMoveBack}
          disabled={activeStageIndex === 0 || isFadingOut}
          appearance="subtle"
        >
          <ChevronLeft size={20} />
        </Button>

        {stagesState.map((stage, index) => {
          const isActive = index === activeStageIndex;
          const Icon = stage.icon;
          return (
            <Button
              key={stage.name}
              onClick={() => handleMoveTo(index)}
              disabled={!stage.enabled || isFadingOut}
              appearance={isActive ? "primary" : "subtle"}
              style={styles.navButton}
            >
              {Icon ? <Icon size={20} /> : <span>{index + 1}</span>}
              {isActive && <span>{str(stage.title)}</span>}
            </Button>
          );
        })}
      </nav>

      <main style={styles.stageContent}>
        <Suspense
          fallback={
            <div>
              <Loader center></Loader>
            </div>
          }
        >
          <ActiveComponent
            {...activeStageProps}
            index={activeStageIndex}
            enabled={stagesState[activeStageIndex]?.enabled || false}
            fadeOutStarted={isFadingOut}
            previousStageIndex={previousStageIndex}
            previousStageName={
              previousStageIndex !== null
                ? stages[previousStageIndex]?.name
                : null
            }
            onMoveForward={handleMoveForward}
            onMoveBack={handleMoveBack}
            onMoveTo={handleMoveToByNameOrIndex}
            stageData={stageData}
            setStageData={handleSetStageData}
          />
        </Suspense>
      </main>
    </div>
  );
}

export default StageView;
