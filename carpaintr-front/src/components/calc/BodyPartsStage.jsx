import { Button, HStack, IconButton, Message, Panel, Placeholder, toaster, VStack } from "rsuite";
import { styles } from "../layout/StageView";
import Trans from "../../localization/Trans";
import { useLocale } from "../../localization/LocaleContext";
import React, { useCallback, useEffect, useState } from "react";
import SelectionInput from "../SelectionInput";
import ArrowBackIcon from '@rsuite/icons/ArrowBack';
import CarBodyPartsSelector from "./CarBodyPartsSelector";
import { authFetchYaml } from "../../utils/authFetch";
import BottomStickyLayout from "../layout/BottomStickyLayout";
import MenuPickerV2 from "../layout/MenuPickerV2";

const REPAIR_QUALITY_OPTIONS = ["normal", "premium", "economy", "perfect"]

const BodyPartsStage = ({ title, index, onMoveForward, onMoveBack, fadeOutStarted, children, onMoveTo, stageData, setStageData }) => {
  const [partsVisual, setPartsVisual] = useState({});
  const [selectedParts, setSelectedParts] = useState([]);
  const [repairQuality, setRepairQuality] = useState("normal");
  const [calculations, setCalculations] = useState({});
  const handleSetSelectedParts = useCallback((val) => setSelectedParts(val), []);
  const { str } = useLocale();


  useEffect(() => {
    const fetchData = async () => {
      try {
        let data = await authFetchYaml('/api/v1/user/global/parts_visual.yaml');
        setPartsVisual(data);
      } catch (error) {
        console.error("Failed to fetch parts_visual:", error);
        toaster.push(<Message type="error">{error.toString()}</Message>)
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    const parts = stageData['parts'];
    if (parts) {
      setSelectedParts(parts.selectedParts);
      setCalculations(parts.calculations);
      setRepairQuality(parts.repairQuality || "normal");
    }
  }, [stageData])

  const handleClose = useCallback(() => {
    const data = {
      partsVisual, selectedParts, calculations
    };
    if (onMoveForward) {
      onMoveForward();
    }
    setStageData({ 'parts': data, calculations });
  }, [onMoveForward, partsVisual, selectedParts, setStageData, calculations])

  return (
    <div style={styles.sampleStage}>
      <div style={{ ...styles.sampleStageInner, opacity: fadeOutStarted ? 0 : 1 }}>
        <BottomStickyLayout bottomPanel={
          <HStack justifyContent="space-between">
            <IconButton icon={<ArrowBackIcon />} onClick={onMoveBack} color='red' appearance='ghost'><Trans>Back</Trans></IconButton>
            <Button onClick={handleClose} disabled={selectedParts === null || selectedParts.length === 0} color='green' appearance='primary'><Trans>Accept</Trans></Button>
          </HStack>
        }>
          <VStack spacing={3} style={{minWidth: "12em"}}>
            <MenuPickerV2
              items={REPAIR_QUALITY_OPTIONS}
              onSelect={setRepairQuality}
              value={repairQuality}
              label={str("Repair quality")}
            />
            <CarBodyPartsSelector
              partsVisual={partsVisual}
              selectedParts={selectedParts}
              onChange={handleSetSelectedParts}
              carClass={stageData['car'].carClass ?? null}
              body={stageData['car'].bodyType ?? null}
              calculations={calculations}
              setCalculations={setCalculations} />
          </VStack>
        </BottomStickyLayout>
      </div>
    </div>
  );
};

export default BodyPartsStage;