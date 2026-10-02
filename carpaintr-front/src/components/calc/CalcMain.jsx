import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import "./CarPaintEstimator.css";
import "./calc_translations";
import { patchDocument, resolveDocument } from "../../calc/calculationDocument";
import { acknowledgeSaved, createSaveCoordinator, shouldRecordUndo } from "../../calc/calculationPersistence";
import { authFetch } from "../../utils/authFetch";
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
  const [savePending, setSavePending] = useState(false);
  const owner = useRef({ epoch: 0, calculationId: null });
  const [state, dispatch] = useReducer((state, action) => {
    if (action.type === 'load') return { document: resolveDocument(action.data), history: [] };
    if (action.type === 'save_ack') return { ...state, document: acknowledgeSaved(state.document, action.snapshot, action.filename) };
    if (action.type === 'undo') {
      if (!state.history.length) return state;
      const previous = state.history.at(-1);
      return { document: resolveDocument({ ...previous, revision: state.document.revision + 1,
        lastSavedRevision: state.document.lastSavedRevision, tableMode: state.document.tableMode, collapseTables: state.document.collapseTables,
        car: { ...previous.car, storeFileName: state.document.car?.storeFileName } }), history: state.history.slice(0, -1) };
    }
    const document = patchDocument(state.document, action.update);
    return document === state.document ? state : { document, history: shouldRecordUndo(state.document, document) ? [...state.history.slice(-49), state.document] : state.history };
  }, undefined, () => ({ document: resolveDocument({ calculationId: crypto.randomUUID() }), history: [] }));
  const document = state.document;
  const saver = useRef(null);
  if (!saver.current) saver.current = createSaveCoordinator({
    getOwner: () => owner.current,
    onPending: setSavePending,
    onAcknowledged: (snapshot, filename) => dispatch({ type: 'save_ack', snapshot, filename }),
    request: async snapshot => {
      const response = await authFetch("/api/v1/user/calculationstore", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(snapshot),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || response.statusText || `HTTP ${response.status}`);
      }
      return response.json();
    },
  });
  const saveDocument = useCallback(snapshot => saver.current.save(snapshot), []);
  const setStageData = useCallback(update => dispatch({ type: 'patch', update }), []);
  const onUndo = useCallback(() => dispatch({ type: 'undo' }), []);

  useEffect(() => {
    if (!isMainMenuStage) localStorage.setItem("unsaved_calculation", JSON.stringify(document));
  }, [document, isMainMenuStage]);

  const handleLoadData = useCallback((data) => {
    const calculationId = data.calculationId ?? crypto.randomUUID();
    owner.current = { epoch: owner.current.epoch + 1, calculationId };
    dispatch({ type: "load", data: { ...data, calculationId } });
    setIsMainMenuStage(false);
  }, []);

  const handleNext = useCallback((mode) => {
    const calculationId = crypto.randomUUID();
    owner.current = { epoch: owner.current.epoch + 1, calculationId };
    dispatch({ type: "load", data: { carSelectionMode: mode, calculationId } });
    setIsMainMenuStage(false);
  }, []);

  return isMainMenuStage ? (
    <CalcMainMenuStage
      onNext={handleNext}
      onLoad={handleLoadData}
    />
  ) : (
    <StageView
      value={document}
      onChange={setStageData}
      onUndo={onUndo}
      saveDocument={saveDocument}
      savePending={savePending}
      stages={stages}
    />
  );
};

export default CalcMain;
