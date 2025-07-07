import { Button, HStack, IconButton, Panel, Placeholder, VStack } from "rsuite";
import { styles } from "../layout/StageView";
import Trans from "../../localization/Trans";
import { useLocale } from "../../localization/LocaleContext";
import React, { useCallback, useEffect, useState } from "react";
import SelectionInput from "../SelectionInput";
import ArrowBackIcon from '@rsuite/icons/ArrowBack';
import CarBodyPartsSelector from "./CarBodyPartsSelector";
import { authFetchYaml } from "../../utils/authFetch";


const BodyPartsStage = ({ title, index, onMoveForward, onMoveBack, fadeOutStarted, children, onMoveTo, stageData, setStageData }) => {
  const [partsVisual, setPartsVisual] = useState({});
  const [selectedParts, setSelectedParts] = useState([]);
  const handleSetSelectedParts = useCallback((val) => setSelectedParts(val), []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        let data = await authFetchYaml('/api/v1/user/global/parts_visual.yaml');
        setPartsVisual(data);
      } catch (error) {
        console.error("Failed to fetch parts_visual:", error);
      }
    };
    fetchData();
  }, [])

  const handleClose = useCallback(() => {
    const data = {
      partsVisual, selectedParts
    };
    if (onMoveForward) {
      onMoveForward();
    }
    setStageData({ 'parts': data });
  }, [onMoveForward, partsVisual, selectedParts, setStageData])

  return (
    <div style={styles.sampleStage}>
      <div style={{ ...styles.sampleStageInner, opacity: fadeOutStarted ? 0 : 1 }}>
        <CarBodyPartsSelector
          partsVisual={partsVisual}
          selectedParts={selectedParts}
          onChange={handleSetSelectedParts}
          carClass={stageData['car'].carClass ?? null}
          body={stageData['car'].bodyType ?? null} />
      </div>
      <HStack justifyContent="space-between">
        <IconButton icon={<ArrowBackIcon />} onClick={onMoveBack} color='red' appearance='ghost'><Trans>Back</Trans></IconButton>
        <Button onClick={handleClose} disabled={selectedParts === null || selectedParts.length === 0} color='green' appearance='primary'><Trans>Accept</Trans></Button>
      </HStack>
    </div>
  );
};

export default BodyPartsStage;