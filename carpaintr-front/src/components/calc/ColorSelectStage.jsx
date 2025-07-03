import { Button, HStack, IconButton, Panel, Placeholder, VStack } from "rsuite";
import { styles } from "../layout/StageView";
import Trans from "../../localization/Trans";
import { useLocale } from "../../localization/LocaleContext";
import React, { useState } from "react";
import SelectionInput from "../SelectionInput";
import ArrowBackIcon from '@rsuite/icons/ArrowBack';

const ColorPicker = React.lazy(() => import("./ColorPicker"));

const ColorSelectStage = ({ title, index, onMoveForward, onMoveBack, fadeOutStarted, children, onMoveTo }) => {
  const [color, setColor] = useState(null);
  const [paintType, setPaintType] = useState(null);
  const { str } = useLocale();

  const paintTypesAndTranslations = {
    "simple": str("No inclusions"),
    "metallic": str("Metallic"),
    "pearl": str("Pearl"),
    "special": str("Special effect")
  };

  return (
    <div style={styles.sampleStage}>
      <div style={{ ...styles.sampleStageInner, opacity: fadeOutStarted ? 0 : 1 }}>
        <Panel header={str("Color and paint type")} eventKey={2}>
          <React.Suspense fallback={<Placeholder.Paragraph rows={8} />}>
            <ColorPicker setColor={setColor} selectedColor={color} />
          </React.Suspense>
          <VStack justifyContent='center' alignItems='center' style={{ margin: "40px" }}>
            <SelectionInput name={str("Paint type")} values={Object.keys(paintTypesAndTranslations)} labels={paintTypesAndTranslations} selectedValue={paintType} onChange={setPaintType} placeholder={str("Select paint type")} />
          </VStack>
          <HStack justifyContent="space-between">
            <IconButton icon={<ArrowBackIcon/>} onClick={onMoveBack} color='red' appearance='ghost'><Trans>Back</Trans></IconButton>
            <Button onClick={onMoveForward} disabled={paintType === null || color === null} color='green' appearance='primary'><Trans>Accept</Trans></Button>
          </HStack>
        </Panel>
      </div>
    </div>
  );
};

export default ColorSelectStage;