import {
  Button,
  HStack,
  IconButton,
  Message,
  toaster,
  VStack,
  Loader,
} from "rsuite";
import { styles } from "../layout/StageView";
import Trans from "../../localization/Trans";
import { useLocale } from "../../localization/LocaleContext";
import { useCallback, useEffect, useState } from "react";
import ArrowBackIcon from "@rsuite/icons/ArrowBack";
import { authFetchYaml } from "../../utils/authFetch";
import BottomStickyLayout from "../layout/BottomStickyLayout";
import MenuPickerV2 from "../layout/MenuPickerV2";
import CarBodyMain from "./CarBodyMain";

const BodyPartsStage = ({
  title,
  index,
  onMoveForward,
  onMoveBack,
  fadeOutStarted,
  children,
  onMoveTo,
  stageData,
  setStageData,
}) => {
  const [partsVisual, setPartsVisual] = useState({});
  const [selectedParts, setSelectedParts] = useState([]);
  const [repairQuality, setRepairQuality] = useState("");
  const [repairQualityOptions, setRepairQualityOptions] = useState([]);
  const [calculations, setCalculations] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const handleSetSelectedParts = useCallback(
    (val) => setSelectedParts(val),
    [],
  );
  const { str } = useLocale();

  // Unified error handler
  const handleError = useCallback((error, context) => {
    const errorMessage = `${context}: ${error.message || error.toString()}`;
    console.error(errorMessage, error);
    setError(errorMessage);
    toaster.push(
      <Message type="error" showIcon closable>
        {errorMessage}
      </Message>,
      { placement: 'topCenter', duration: 5000 }
    );
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Fetch parts visual data
        const partsVisualData = await authFetchYaml("/api/v1/user/global/parts_visual.yaml");
        console.log("Parts visual data fetched:", partsVisualData);
        setPartsVisual(partsVisualData);

        // Fetch quality options
        const qualityData = await authFetchYaml("/api/v1/user/global/quality.yaml");
        console.log("Quality options fetched:", qualityData);
        setRepairQualityOptions(qualityData.options || []);
        setRepairQuality(qualityData.default || "");

        // Show success message
        toaster.push(
          <Message type="success" showIcon closable>
            <Trans>Data loaded successfully</Trans>
          </Message>,
          { placement: 'topCenter', duration: 2000 }
        );
      } catch (error) {
        handleError(error, "Failed to fetch configuration data");
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [handleError]);

  useEffect(() => {
    try {
      const parts = stageData["parts"];
      if (parts) {
        console.log("Loading stage data:", parts);
        setSelectedParts(parts.selectedParts || []);
        setCalculations(parts.calculations || {});
        setRepairQuality(parts.repairQuality || "");
      }
    } catch (error) {
      handleError(error, "Failed to load stage data");
    }
  }, [stageData, handleError]);

  const handleClose = useCallback(() => {
    try {
      const data = {
        partsVisual,
        selectedParts,
        calculations,
        repairQuality,
      };
      
      console.log("Saving stage data:", data);
      setStageData({ parts: data, calculations });
      
      if (onMoveForward) {
        onMoveForward();
      }
    } catch (error) {
      handleError(error, "Failed to save data");
    }
  }, [onMoveForward, partsVisual, selectedParts, calculations, repairQuality, setStageData, handleError]);

  // Show loading state
  if (isLoading) {
    return (
      <div style={styles.sampleStage}>
        <div style={{ ...styles.sampleStageInner, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <VStack spacing={3} alignItems="center">
            <Loader size="lg" content={<Trans>Loading configuration...</Trans>} />
          </VStack>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div style={styles.sampleStage}>
        <div style={styles.sampleStageInner}>
          <VStack spacing={3} alignItems="center">
            <Message type="error" showIcon>
              {error}
            </Message>
            <HStack spacing={2}>
              <Button onClick={() => window.location.reload()} appearance="primary">
                <Trans>Retry</Trans>
              </Button>
              {onMoveBack && (
                <Button onClick={onMoveBack} appearance="ghost">
                  <Trans>Back</Trans>
                </Button>
              )}
            </HStack>
          </VStack>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.sampleStage}>
      <div
        style={{ ...styles.sampleStageInner, opacity: fadeOutStarted ? 0 : 1 }}
      >
        <BottomStickyLayout
          bottomPanel={
            <div className="flex justify-between">
              <IconButton
                icon={<ArrowBackIcon />}
                onClick={onMoveBack}
                color="red"
                appearance="ghost"
              >
                <Trans>Back</Trans>
              </IconButton>
              <Button
                onClick={handleClose}
                disabled={selectedParts === null || selectedParts.length === 0}
                color="green"
                appearance="primary"
              >
                <Trans>Accept</Trans>
              </Button>
            </div>
          }
        >
          <VStack spacing={3} style={{ minWidth: "12em" }}>
            <MenuPickerV2
              items={repairQualityOptions}
              onSelect={setRepairQuality}
              value={repairQuality}
              label={str("Repair quality")}
              style={{ width: "100%" }}
            />
            <CarBodyMain
              partsVisual={partsVisual}
              selectedParts={selectedParts}
              onChange={handleSetSelectedParts}
              carClass={stageData["car"]?.carClass ?? ''}
              body={stageData["car"]?.bodyType ?? ''}
              calculations={calculations}
              setCalculations={setCalculations}
            />
          </VStack>
        </BottomStickyLayout>
      </div>
    </div>
  );
};

export default BodyPartsStage;