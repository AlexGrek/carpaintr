import React, { useCallback, useEffect, useState } from "react";
import {
  Button,
  DatePicker,
  Divider,
  HStack,
  IconButton,
  Input,
  Panel,
  VStack,
} from "rsuite";
import ArrowBackIcon from "@rsuite/icons/ArrowBack";
import { styles } from "../layout/StageView";
import Trans from "../../localization/Trans";
import BottomStickyLayout from "../layout/BottomStickyLayout";
import { EvaluationResultsTable } from "./EvaluationResultsTable";
import PrintCalculationDrawer from "../PrintCalculationDrawer";
import { Shapes } from "lucide-react";
import { cloneDeep } from "lodash";
import { authFetch } from "../../utils/authFetch";
import { useLocale } from "../../localization/LocaleContext";
import { capitalizeFirstLetter } from "../../utils/utils";
import NotifyMessage from "../layout/NotifyMessage";

const TableFinalStage = ({
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
  const [printDrawerOpen, setPrintDrawerOpen] = useState(false);
  const { str } = useLocale();
  const [orderNumber, setOrderNumber] = useState("0");
  // Default orderDate = Today
  const [orderDate, setOrderDate] = useState(new Date());
  const showMessage = useCallback(
    (type, message) => {
      setN(`${str(capitalizeFirstLetter(type))} ${message}`);
    },
    [str],
  );

  const [n, setN] = useState(null);

  const handleSave = useCallback(async () => {
    const dataToSave = cloneDeep(stageData);

    try {
      const response = await authFetch("/api/v1/user/calculationstore", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(dataToSave),
      });
      if (response.ok) {
        showMessage("success", str("Calculation saved successfully!"));
        const data = await response.json();
        console.log("Got data: " + JSON.stringify(data));
        setStageData({
          ...dataToSave,
          car: { ...dataToSave.car, storeFileName: data.saved_file_path },
        });
      } else {
        const errorData = await response.json();
        showMessage(
          "error",
          `${str("Failed to save calculation:")} ${errorData.message || response.statusText}`,
        );
      }
    } catch (error) {
      console.error("Error saving calculation:", error);
      showMessage(
        "error",
        `${str("Error saving calculation:")} ${error.message}`,
      );
    }
  }, [setStageData, showMessage, stageData, str]);

  return (
    <div style={styles.sampleStage}>
      <div
        style={{ ...styles.sampleStageInner, opacity: fadeOutStarted ? 0 : 1 }}
      >
        <BottomStickyLayout
          bottomPanel={
            <HStack justifyContent="space-between">
              <IconButton
                icon={<ArrowBackIcon />}
                onClick={onMoveBack}
                color="red"
                appearance="ghost"
              >
                <Trans>Back</Trans>
              </IconButton>
              <div>
                <Button
                  onClick={() => handleSave()}
                  color="blue"
                  appearance="primary"
                >
                  <Trans>Save</Trans>
                </Button>
                <Button
                  onClick={() => setPrintDrawerOpen(true)}
                  color="green"
                  appearance="primary"
                  style={{ marginLeft: "6pt" }}
                >
                  <Trans>Print</Trans>
                </Button>
              </div>
            </HStack>
          }
        >
          <div>
            <NotifyMessage text={n} />
            <section>
              <p>
                <Trans>Order date</Trans>
              </p>
              <DatePicker
                format="dd.MM.yyyy"
                oneTap
                value={orderDate}
                onChange={setOrderDate}
                placeholder={str("Select date")}
              />
              <p>
                <Trans>Order number</Trans>
              </p>
              <Input onChange={setOrderNumber} value={orderNumber} />
            </section>
            <Panel header={str("Tables")}>
              {stageData.calculations &&
                Object.keys(stageData.calculations).map((key) => {
                  return (
                    <div key={key}>
                      <Divider />
                      <HStack>
                        <Shapes />
                        <h4>{key}</h4>
                      </HStack>
                      <EvaluationResultsTable
                        data={stageData.calculations[key]}
                        setData={(value) => {
                          setStageData({
                            ...stageData,
                            calculations: {
                              ...stageData.calculations,
                              [key]: value,
                            },
                          });
                        }}
                        skipIncorrect={true}
                      />
                    </div>
                  );
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
          carData={stageData["car"]}
          paintData={stageData["paint"]}
        />
      </div>
    </div>
  );
};

export default TableFinalStage;
