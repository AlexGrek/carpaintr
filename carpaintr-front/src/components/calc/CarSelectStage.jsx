import { Button, Divider, Input, Panel, Text } from "rsuite";
import { styles } from "../layout/StageView";
import VehicleSelect from "./VehicleSelect";
import Trans from "../../localization/Trans";
import { useLocale } from "../../localization/LocaleContext";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import BottomStickyLayout from "../layout/BottomStickyLayout";

const CarSelectStage = ({ title, index, onMoveForward, onMoveBack, fadeOutStarted, children, onMoveTo, stageData, setStageData }) => {

  const [make, setMake] = useState(null);
  const [model, setModel] = useState(null);
  const [year, setYear] = useState(null);
  const [carClass, setCarClass] = useState(null);
  const [bodyType, setBodyType] = useState(null);
  const [licensePlate, setLicensePlate] = useState("");
  const [VIN, setVIN] = useState("");
  const [notes, setNotes] = useState("");
  const [isFromLoading, setIsFromLoading] = useState(false);
  const [storeFileName, setStoreFileName] = useState(null);
  const [selectModelMode, setSelectModelMode] = useState(false);

  const [searchParams] = useSearchParams();


  useEffect(() => {
    const car = stageData['car'];
    if (car) {
      setMake(car.make ?? null);
      setModel(car.model ?? null);
      setYear(car.year ?? null);
      setCarClass(car.carClass ?? null);
      setBodyType(car.bodyType ?? null);
      setLicensePlate(car.licensePlate ?? "");
      setVIN(car.VIN ?? "");
      setNotes(car.notes ?? "");
      setStoreFileName(car.storeFileName ?? null);
      setIsFromLoading(true);
      if (car.make) {
        setSelectModelMode(true)
      } else {
        setSelectModelMode(false)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleClose = useCallback(() => {
    const data = {
      make, model, year, carClass, bodyType, licensePlate, VIN, notes, storeFileName
    };
    if (onMoveForward) {
      onMoveForward();
    }
    setStageData({ 'car': data });
  }, [VIN, bodyType, carClass, licensePlate, make, model, notes, onMoveForward, setStageData, storeFileName, year])

  useEffect(() => {
    const idFromUrl = searchParams.get('id');
    if (idFromUrl) {
      //handleLoad(idFromUrl);
    }
  }, [searchParams]);

  const { str } = useLocale();

  return (
    <div style={styles.sampleStage}>
      <div style={{ ...styles.sampleStageInner, opacity: fadeOutStarted ? 0 : 1 }}>
        <BottomStickyLayout
          bottomPanel={<Button onClick={handleClose} disabled={carClass === null || bodyType === null || year === null} color='green' appearance='primary'>
            <Trans>Accept</Trans>
          </Button>}>
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
            selectModelMode={selectModelMode}
            setSelectModelMode={setSelectModelMode}
            year={year}
            vin={VIN}
            setVin={setVIN}
            isFromLoading={isFromLoading}
          />
          {year != null && <div className="pop-in-simple">
            <Divider><Trans>Additional info</Trans></Divider>
            <Input value={make} onChange={setMake} placeholder={str('Car brand')}></Input>
            <Input value={model} onChange={setModel} placeholder={str('Car model')}></Input>
            <br/>
            <Input value={licensePlate} onChange={setLicensePlate} placeholder={str('License plate (optional)')}></Input>
            <Input value={VIN} onChange={setVIN} placeholder={str('VIN (optional)')}></Input>
            <br/>
            <Input as='textarea' rows={3} value={notes} onChange={setNotes} placeholder={str('Notes')}></Input>
          </div>}
        </BottomStickyLayout>
      </div>
    </div>
  );
};

export default CarSelectStage;