import { Button, HStack, IconButton, VStack } from "rsuite";
import { styles } from "../layout/StageView";
import Trans from "../../localization/Trans";
import { useLocale } from "../../localization/LocaleContext";
import React, { useCallback, useEffect, useState } from "react";
import SelectionInput from "../SelectionInput";
import ArrowBackIcon from "@rsuite/icons/ArrowBack";
import BottomStickyLayout from "../layout/BottomStickyLayout";
import ColorPicker from "./ColorPicker";

const ColorSelectStage = ({
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
  const [color, setColor] = useState(null);
  const [paintType, setPaintType] = useState(null);
  const { str } = useLocale();

  useEffect(() => {
    const p = stageData["paint"];
    if (p) {
      setColor(p.color ?? null);
      setPaintType(p.paintType ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClose = useCallback(() => {
    const data = {
      color,
      paintType,
    };
    if (onMoveForward) {
      onMoveForward();
    }
    setStageData({ paint: data });
  }, [color, onMoveForward, paintType, setStageData]);

  const paintTypesAndTranslations = {
    simple: str("No inclusions"),
    metallic: str("Metallic"),
    pearl: str("Pearl"),
    special: str("Special effect"),
  };

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
              <Button
                onClick={handleClose}
                disabled={paintType === null || color === null}
                color="green"
                appearance="primary"
              >
                <Trans>Accept</Trans>
              </Button>
            </HStack>
          }
        >
          <ColorPicker setColor={setColor} selectedColor={color} />
          <VStack
            justifyContent="center"
            alignItems="center"
            style={{ margin: "40px" }}
          >
            <SelectionInput
              name={str("Paint type")}
              values={Object.keys(paintTypesAndTranslations)}
              labels={paintTypesAndTranslations}
              selectedValue={paintType}
              onChange={setPaintType}
              placeholder={str("Select paint type")}
            />
          </VStack>
        </BottomStickyLayout>
      </div>
    </div>
  );
};

export default ColorSelectStage;
