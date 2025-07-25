import { Button, HStack, IconButton, Panel, Placeholder, VStack } from "rsuite";
import { styles } from "../layout/StageView";
import Trans from "../../localization/Trans";
import { useLocale } from "../../localization/LocaleContext";
import React, { useCallback, useEffect, useState } from "react";
import SelectionInput from "../SelectionInput";
import ArrowBackIcon from '@rsuite/icons/ArrowBack';
import BottomStickyLayout from "../layout/BottomStickyLayout";
import { EvaluationResultsTable } from "./EvaluationResultsTable";
import PrintCalculationDrawer from "../PrintCalculationDrawer";
import { Shapes } from "lucide-react";

const TableFinalStage = ({ title, index, onMoveForward, onMoveBack, fadeOutStarted, children, onMoveTo, stageData, setStageData }) => {
  const [printDrawerOpen, setPrintDrawerOpen] = useState(false);
  const handleClose = useCallback(() => {
    onMoveForward()
  }, [onMoveForward])

  return (
    <div style={styles.sampleStage}>
      <div style={{ ...styles.sampleStageInner, opacity: fadeOutStarted ? 0 : 1 }}>
        <BottomStickyLayout bottomPanel={
          <HStack justifyContent="space-between">
            <IconButton icon={<ArrowBackIcon />} onClick={onMoveBack} color='red' appearance='ghost'><Trans>Back</Trans></IconButton>
            <Button onClick={() => setPrintDrawerOpen(true)} color='green' appearance='primary'><Trans>Print</Trans></Button>
          </HStack>
        }>
          {stageData.calculations && Object.keys(stageData.calculations).map((key) => {
            return <div key={key}>
              <HStack><Shapes /><h4>{key}</h4></HStack>
              <EvaluationResultsTable data={stageData.calculations[key]} />
            </div>
          })}
        </BottomStickyLayout>
        <PrintCalculationDrawer show={printDrawerOpen} onClose={() => setPrintDrawerOpen(false)} calculationData={stageData.calculations || null} />
      </div>
    </div>
  );
};

export default TableFinalStage;