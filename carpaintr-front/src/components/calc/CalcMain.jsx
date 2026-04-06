import { useCallback, useState } from "react";
import "./CarPaintEstimator.css";
import "./calc_translations";
import StageView from "../layout/StageView";
import { Car, CarFront, Paintbrush, Table2 } from "lucide-react";
import CalcMainMenuStage from "./CalcMainMenuStage";
import CarSelectStage from "./CarSelectStage";
import ColorSelectStage from "./ColorSelectStage";
import BodyPartsStage from "./BodyPartsStage";
import TableFinalStage from "./TableFinalStage";

const stages = [
  {
    name: "carSelectStage",
    title: "Car select",
    icon: CarFront,
    component: CarSelectStage,
  },
  {
    name: "paintSelectStage",
    title: "Paint select",
    icon: Paintbrush,
    component: ColorSelectStage,
  },
  {
    name: "bodyPartsSelectStage",
    title: "Body parts",
    icon: Car,
    component: BodyPartsStage,
  },
  {
    name: "tableStage",
    title: "Finalize",
    icon: Table2,
    component: TableFinalStage,
  },
];

const CalcMain = () => {
  const [isMainMenuStage, setIsMainMenuStage] = useState(true);
  const [initialState, setInitialState] = useState({});

  const handleOnSave = useCallback((data) => {
    localStorage.setItem("unsaved_calculation", JSON.stringify(data));
  }, []);

  const handleLoadData = useCallback((data) => {
    setInitialState(data);
    setIsMainMenuStage(false);
  }, []);

  return isMainMenuStage ? (
    <CalcMainMenuStage
      onNext={() => setIsMainMenuStage(false)}
      onLoad={handleLoadData}
    />
  ) : (
    <StageView
      onSave={handleOnSave}
      initialState={initialState}
      stages={stages}
    />
  );
};

export default CalcMain;
