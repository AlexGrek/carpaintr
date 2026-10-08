import { Button, Input } from "rsuite";
import { ClipboardList } from "lucide-react";
import { styles } from "../layout/StageView";
import VehicleSelect from "./VehicleSelect";
import Trans from "../../localization/Trans";
import { useLocale } from "../../localization/LocaleContext";
import { useCallback, useEffect, useState } from "react";
import BottomStickyLayout from "../layout/BottomStickyLayout";
import StageSection from "../layout/StageSection";

const Field = ({ label, className = "", children }) => (
  <label className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
    <span className="text-xs font-medium text-slate-600">{label}</span>
    {children}
  </label>
);

const CarSelectStage = ({
  title: _title,
  index: _index,
  onMoveForward,
  onMoveBack: _onMoveBack,
  fadeOutStarted,
  children: _children,
  onMoveTo: _onMoveTo,
  stageData,
  setStageData,
}) => {
  const [make, setMake] = useState(stageData.car?.make ?? null);
  const [model, setModel] = useState(stageData.car?.model ?? null);
  const [year, setYear] = useState(stageData.car?.year ?? null);
  const [carClass, setCarClass] = useState(stageData.car?.carClass ?? null);
  const [bodyType, setBodyType] = useState(stageData.car?.bodyType ?? null);
  const [licensePlate, setLicensePlate] = useState(stageData.car?.licensePlate ?? "");
  const [VIN, setVIN] = useState(stageData.car?.VIN ?? stageData.car?.vin ?? "");
  const [notes, setNotes] = useState(stageData.car?.notes ?? "");
  const [isFromLoading, setIsFromLoading] = useState(false);
  const storeFileName = stageData.car?.storeFileName ?? null;
  const [selectModelMode, setSelectModelMode] = useState(false);

  useEffect(() => {
    const mode = stageData["carSelectionMode"];
    if (mode === "brand") {
      setSelectModelMode(true);
    } else if (mode === "type") {
      setSelectModelMode(false);
    }
    // "vin" mode doesn't strictly need a switch here, but we can pass a prop to VehicleSelect to open the modal

    const car = stageData["car"];
    if (car) {
      setMake(car.make ?? null);
      setModel(car.model ?? null);
      setYear(car.year ?? null);
      setCarClass(car.carClass ?? null);
      setBodyType(car.bodyType ?? null);
      setLicensePlate(car.licensePlate ?? "");
      setVIN(car.VIN ?? car.vin ?? "");
      setNotes(car.notes ?? "");
      setIsFromLoading(true);
      if (car.make) {
        setSelectModelMode(true);
      } else {
        setSelectModelMode(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const car = { ...stageData.car, make, model, year: String(year ?? ''), carClass, bodyType, licensePlate, vin: VIN, notes, storeFileName };
    setStageData(prev => JSON.stringify(prev.car) === JSON.stringify(car) ? prev : { ...prev, car });
  }, [make, model, year, carClass, bodyType, licensePlate, VIN, notes, storeFileName, setStageData, stageData.car]);
  const handleClose = useCallback(() => {
    const data = {
      ...stageData.car,
      make,
      model,
      year: String(year ?? ""),
      carClass,
      bodyType,
      licensePlate,
      vin: VIN,
      notes,
      storeFileName,
    };
    if (onMoveForward) {
      onMoveForward();
    }
    setStageData({ car: data });
  }, [
    VIN,
    bodyType,
    carClass,
    licensePlate,
    make,
    model,
    notes,
    onMoveForward,
    setStageData,
    storeFileName,
    stageData.car,
    year,
  ]);

  const { str } = useLocale();

  return (
    <div style={styles.sampleStage} data-testid="calc-car-select-stage">
      <div
        style={{ ...styles.sampleStageInner, opacity: fadeOutStarted ? 0 : 1 }}
      >
        <BottomStickyLayout
          bottomPanel={
            <Button
              onClick={handleClose}
              disabled={carClass === null || bodyType === null || year === null}
              color="green"
              appearance="primary"
              data-testid="calc-car-stage-accept-button"
            >
              <Trans>Accept</Trans>
            </Button>
          }
        >
          <VehicleSelect
            autoOpenVin={stageData["carSelectionMode"] === "vin"}
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
          {year != null && (
            <StageSection
              icon={ClipboardList}
              title={str("Additional info")}
              className="pop-in-simple mt-3"
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label={str("Car brand")}>
                  <Input
                    value={make ?? ""}
                    onChange={setMake}
                    data-testid="calc-car-make-input"
                  />
                </Field>
                <Field label={str("Car model")}>
                  <Input
                    value={model ?? ""}
                    onChange={setModel}
                    data-testid="calc-car-model-input"
                  />
                </Field>
                <Field label={str("License plate (optional)")}>
                  <Input
                    value={licensePlate}
                    onChange={setLicensePlate}
                    data-testid="calc-car-license-plate-input"
                  />
                </Field>
                <Field label={str("VIN (optional)")}>
                  <Input
                    value={VIN}
                    onChange={setVIN}
                    data-testid="calc-car-vin-input"
                  />
                </Field>
                <Field label={str("Notes")} className="sm:col-span-2">
                  <Input
                    as="textarea"
                    rows={3}
                    value={notes}
                    onChange={setNotes}
                    data-testid="calc-car-notes-input"
                  />
                </Field>
              </div>
            </StageSection>
          )}
        </BottomStickyLayout>
      </div>
    </div>
  );
};

export default CarSelectStage;
