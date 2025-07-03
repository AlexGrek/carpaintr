import { Button, Divider, Input, Panel } from "rsuite";
import { styles } from "../layout/StageView";
import VehicleSelect from "./VehicleSelect";
import Trans from "../../localization/Trans";
import { useLocale } from "../../localization/LocaleContext";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

const CarSelectStage = ({ title, index, onMoveForward, onMoveBack, fadeOutStarted, children, onMoveTo }) => {

  const [make, setMake] = useState(null);
  const [model, setModel] = useState(null);
  const [year, setYear] = useState(null);
  const [carClass, setCarClass] = useState(null);
  const [bodyType, setBodyType] = useState(null);
  const [licensePlate, setLicensePlate] = useState("");
  const [VIN, setVIN] = useState("");
  const [notes, setNotes] = useState("");
  const [searchParams] = useSearchParams();
  const [storeFileName, setStoreFileName] = useState(null);

  useEffect(() => {
    const idFromUrl = searchParams.get('id');
    if (idFromUrl) {
      //handleLoad(idFromUrl);
    }
  }, [searchParams]); // Depend on searchParams and handleLoad

  const { str } = useLocale();

  return (
    <div style={styles.sampleStage}>
      <div style={{ ...styles.sampleStageInner, opacity: fadeOutStarted ? 0 : 1 }}>
        <Panel className='fade-in-simple' header={year === null ? str("Car") : `${make || ''} ${model || ''} ${year || ''} / ${carClass || ''} ${bodyType || ''}`} eventKey={1}>
          <VehicleSelect
            selectedBodyType={bodyType}
            carclass={carClass}
            setCarClass={setCarClass}
            selectedMake={make}
            selectedModel={model}
            setMake={setMake}
            setBodyType={setBodyType}
            setModel={setModel}
            setYear={setYear}
            year={year}
            isFromLoading={storeFileName != null}
          />
          <Divider><Trans>Additional info</Trans></Divider>
          <Input value={licensePlate} onChange={setLicensePlate} placeholder={str('License plate (optional)')}></Input>
          <Input value={VIN} onChange={setVIN} placeholder={str('VIN (optional)')}></Input>
          <Input as='textarea' value={notes} onChange={setNotes} placeholder={str('Notes')}></Input>
        </Panel>
        <Button onClick={onMoveForward} disabled={carClass === null || bodyType === null} color='green' appearance='primary'><Trans>Accept</Trans></Button>
      </div>
    </div>
  );
};

export default CarSelectStage;