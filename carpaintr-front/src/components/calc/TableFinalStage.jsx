import React, { useCallback, useEffect, useState } from "react";
import { Button, DatePicker, HStack, IconButton, Input, Panel, VStack } from "rsuite";
import ArrowBackIcon from '@rsuite/icons/ArrowBack';
import { styles } from "../layout/StageView";
import Trans from "../../localization/Trans";
import BottomStickyLayout from "../layout/BottomStickyLayout";
import { EvaluationResultsTable } from "./EvaluationResultsTable";
import PrintCalculationDrawer from "../PrintCalculationDrawer";
import { Shapes } from "lucide-react";

const TableFinalStage = ({ title, index, onMoveForward, onMoveBack, fadeOutStarted, children, onMoveTo, stageData, setStageData }) => {
  const [printDrawerOpen, setPrintDrawerOpen] = useState(false);
  const [orderNumber, setOrderNumber] = useState('0');
  // Default orderDate = Today
  const [orderDate, setOrderDate] = useState(new Date());

  return (
    <div style={styles.sampleStage}>
      <div style={{ ...styles.sampleStageInner, opacity: fadeOutStarted ? 0 : 1 }}>
        <BottomStickyLayout bottomPanel={
          <HStack justifyContent="space-between">
            <IconButton icon={<ArrowBackIcon />} onClick={onMoveBack} color='red' appearance='ghost'>
              <Trans>Back</Trans>
            </IconButton>
            <Button onClick={() => setPrintDrawerOpen(true)} color='green' appearance='primary'>
              <Trans>Print</Trans>
            </Button>
          </HStack>
        }>
          <div>
            <section>
              <p>Order date</p>
              <DatePicker
                oneTap
                value={orderDate}
                onChange={setOrderDate}
                placeholder="Select date"
              />
              <p>Order number</p>
              <Input onChange={setOrderNumber} value={orderNumber} />
            </section>
            <Panel header={"Tables"}>
              {stageData.calculations && Object.keys(stageData.calculations).map((key) => {
                return <div key={key}>
                  <HStack><Shapes /><h4>{key}</h4></HStack>
                  <EvaluationResultsTable data={stageData.calculations[key]} setData={(value) => {
                    setStageData({ ...stageData, calculations: { ...stageData.calculations, [key]: value } })
                  }} />
                </div>
              })}
            </Panel>
          </div>
        </BottomStickyLayout>
        <PrintCalculationDrawer
          show={printDrawerOpen}
          onClose={() => setPrintDrawerOpen(false)}
          partsData={stageData.parts || []}
          calculationData={stageData.calculations || {}}
          orderData={{ orderNumber, orderDate }}
          carData={stageData['car']}
          paintData={stageData['paint']}
        />
      </div>
    </div>
  );
};

export default TableFinalStage;
