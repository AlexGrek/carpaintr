import React, { useState, useEffect, Suspense, useMemo } from 'react';
import { Button, Loader } from 'rsuite';
import 'rsuite/dist/rsuite.min.css'; // Using pre-compiled CSS for simplicity
import { ChevronLeft, Home, User, Settings, CheckCircle } from 'lucide-react';
import { useLocale } from '../../localization/LocaleContext';

// --- RSuite Color Palette (for inline styles) ---
// These CSS variables are available because we import the RSuite stylesheet.
const rsuiteColors = {
  primary: 'var(--rs-primary-500)',
  primaryHover: 'var(--rs-primary-600)',
  textPrimary: 'var(--rs-text-primary)',
  textSecondary: 'var(--rs-text-secondary)',
  textDisabled: 'var(--rs-text-disabled)',
  bgActive: 'var(--rs-bg-active)',
  border: 'var(--rs-border-primary)',
  subtle: 'var(--rs-btn-subtle-bg)',
};

// --- STYLES ---
export const styles = {
  stageViewContainer: {
    fontFamily: 'sans-serif',
    width: '100%',
  },
  navBar: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '3px 0',
    marginBottom: '20px',
    borderBottom: `1px solid ${rsuiteColors.border}`,
    gap: '8px',
  },
  navButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  stageContent: {
    width: '100%',
  },
  sampleStage: {
    // padding: '10px',
    textAlign: 'center',
    // border: `1px dashed ${rsuiteColors.border}`,
    // borderRadius: '8px',
    margin: '0 3px',
    width: '100%',
  },
  sampleStageInner: {
    transition: 'opacity 200ms ease-in-out',
  },
  buttonGroup: {
    display: 'flex',
    gap: '10px',
    justifyContent: 'center',
    marginTop: '16px',
  }
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
function StageView({ stages, initialState = {}, animationDelay = 100 }) {
  const [activeStageIndex, setActiveStageIndex] = useState(0);
  const [previousStageIndex, setPreviousStageIndex] = useState(null);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [stageData, setStageDataState] = useState(initialState);
  const { str } = useLocale();
  
  // Initialize state for each stage, enabling the first one by default.
  const [stagesState, setStagesState] = useState(() =>
    stages.map((stage, index) => ({
      ...stage,
      enabled: index === 0,
    }))
  );

  // Effect to handle browser history (back/forward buttons)
  useEffect(() => {
    const handlePopState = (event) => {
      const targetIndex = event.state?.stageIndex;
      if (typeof targetIndex === 'number' && targetIndex !== activeStageIndex) {
        handleMoveTo(targetIndex, { isFromPopState: true });
      }
    };

    window.history.replaceState({ stageIndex: 0 }, '');
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [stages, animationDelay]); // Rerun if stages change

  /**
   * Updates the shared state. Merges new data with existing data.
   * @param {object} newData - The new data to merge into the state.
   */
  const handleSetStageData = (newData) => {
    console.log("State update registered")
    console.log(newData);
    setStageDataState(prevData => ({ ...prevData, ...newData }));
  };

  const handleMoveTo = (targetIndex, { isFromPopState = false, isMovingForward = false } = {}) => {
    if (isFadingOut || targetIndex === activeStageIndex || !stagesState[targetIndex]?.enabled) {
      return;
    }
    
    setIsFadingOut(true);

    setTimeout(() => {
      setPreviousStageIndex(activeStageIndex);
      setActiveStageIndex(targetIndex);

      if (isMovingForward && stagesState[targetIndex]) {
        setStagesState(prev => {
          const newState = [...prev];
          newState[targetIndex].enabled = true;
          return newState;
        });
      }

      if (!isFromPopState) {
        window.history.pushState({ stageIndex: targetIndex }, '', window.location.pathname);
      }
      
      setIsFadingOut(false);
    }, animationDelay);
  };

  const handleMoveForward = () => {
    const nextIndex = activeStageIndex + 1;
    if (nextIndex < stages.length) {
      setStagesState(prev => {
        const newState = [...prev];
        if(newState[nextIndex]) newState[nextIndex].enabled = true;
        return newState;
      });
      handleMoveTo(nextIndex, { isMovingForward: true });
    }
  };

  const handleMoveBack = () => {
    if (activeStageIndex > 0) {
      handleMoveTo(activeStageIndex - 1);
    }
  };

  const handleMoveToByNameOrIndex = (identifier) => {
    const targetIndex = typeof identifier === 'number'
      ? identifier
      : stages.findIndex(s => s.name === identifier);

    if (targetIndex !== -1) {
      handleMoveTo(targetIndex);
    }
  };

  const { component: ActiveComponent, ...activeStageProps } = useMemo(
    () => stages[activeStageIndex],
    [activeStageIndex, stages]
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
              appearance={isActive ? 'primary' : 'subtle'}
              style={styles.navButton}
            >
              {Icon ? <Icon size={20} /> : <span>{index + 1}</span>}
              {isActive && <span>{str(stage.title)}</span>}
            </Button>
          );
        })}
      </nav>

      <main style={styles.stageContent}>
        <Suspense fallback={<div><Loader center></Loader></div>}>
          <ActiveComponent
            {...activeStageProps}
            index={activeStageIndex}
            enabled={stagesState[activeStageIndex].enabled}
            fadeOutStarted={isFadingOut}
            previousStageIndex={previousStageIndex}
            previousStageName={previousStageIndex !== null ? stages[previousStageIndex].name : null}
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