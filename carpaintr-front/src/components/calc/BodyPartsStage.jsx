import {
  Button,
  HStack,
  IconButton,
  Message,
  SelectPicker,
  toaster,
  VStack,
  Loader,
} from "rsuite";
import { Sparkles } from "lucide-react";
import { styles } from "../layout/StageView";
import Trans from "../../localization/Trans";
import { useLocale, registerTranslations } from "../../localization/LocaleContext";
import { useCallback, useEffect, useMemo, useState } from "react";
import ArrowBackIcon from "@rsuite/icons/ArrowBack";
import { authFetchYaml } from "../../utils/authFetch";
import BottomStickyLayout from "../layout/BottomStickyLayout";
import CarBodyMain from "./CarBodyMain";

registerTranslations("en", {
  "Data loaded successfully": "Data loaded successfully",
  "Loading configuration...": "Loading configuration...",
  "Retry": "Retry",
  "Back": "Back",
  "Accept": "Accept",
  "Repair quality": "Repair quality",
  "Failed to fetch configuration data": "Failed to fetch configuration data",
  "Failed to load stage data": "Failed to load stage data",
  "Failed to save data": "Failed to save data",
});

registerTranslations("ua", {
  "Data loaded successfully": "Дані успішно завантажені",
  "Loading configuration...": "Завантаження конфігурації...",
  "Retry": "Повторити",
  "Back": "Назад",
  "Accept": "Прийняти",
  "Repair quality": "Якість ремонту",
  "Failed to fetch configuration data": "Помилка завантаження даних конфігурації",
  "Failed to load stage data": "Помилка завантаження даних етапу",
  "Failed to save data": "Помилка збереження даних",
});

const BodyPartsStage = ({
  title: _title,
  index: _index,
  onMoveForward,
  onMoveBack,
  fadeOutStarted,
  children: _children,
  onMoveTo: _onMoveTo,
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

  const qualityPickerData = useMemo(
    () =>
      repairQualityOptions.map((option) =>
        typeof option === "string"
          ? { label: option, value: option }
          : { label: option.label ?? option.value, value: option.value },
      ),
    [repairQualityOptions],
  );

  // Unified error handler
  const handleError = useCallback((error, context) => {
    const translatedContext = str(context);
    const errorMessage = `${translatedContext}: ${error.message || error.toString()}`;
    console.error(errorMessage, error);
    setError(errorMessage);
    toaster.push(
      <Message type="error" showIcon closable>
        {errorMessage}
      </Message>,
      { placement: 'topCenter', duration: 5000 }
    );
  }, [str]);

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
                data-testid="calc-body-parts-stage-back-button"
              >
                <Trans>Back</Trans>
              </IconButton>
              <Button
                onClick={handleClose}
                disabled={selectedParts === null || selectedParts.length === 0}
                color="green"
                appearance="primary"
                data-testid="calc-body-parts-stage-accept-button"
              >
                <Trans>Accept</Trans>
              </Button>
            </div>
          }
        >
          <VStack spacing={3} style={{ minWidth: "12em" }}>
            <div
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm"
              data-testid="calc-repair-quality-picker"
            >
              <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <Sparkles size={14} />
                {str("Repair quality")}
              </div>
              <SelectPicker
                data={qualityPickerData}
                value={repairQuality || null}
                onChange={(value) => setRepairQuality(value ?? "")}
                cleanable={false}
                searchable={false}
                block
                data-testid="calc-repair-quality-select"
              />
            </div>
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