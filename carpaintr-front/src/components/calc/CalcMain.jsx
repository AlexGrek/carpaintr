import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import "./CarPaintEstimator.css";
import "./calc_translations";
import { patchDocument, resolveDocument } from "../../calc/calculationDocument";
import { acknowledgeSaved, createSaveCoordinator, shouldRecordUndo } from "../../calc/calculationPersistence";
import { authFetch, handleAuthResponse } from "../../utils/authFetch";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Loader, Message, useToaster } from "rsuite";
import { useLocale } from "../../localization/LocaleContext";
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
  const [searchParams] = useSearchParams();
  // `?id=<saved file stem>` (history links, MCP app_url) opens that calculation directly.
  const savedId = searchParams.get("id");
  const [isMainMenuStage, setIsMainMenuStage] = useState(true);
  const [openingSaved, setOpeningSaved] = useState(Boolean(savedId));
  const navigate = useNavigate();
  const location = useLocation();
  const toaster = useToaster();
  const { str } = useLocale();
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

  useEffect(() => {
    if (!savedId) return;
    let cancelled = false;
    const filename = savedId.endsWith(".json") ? savedId : `${savedId}.json`;
    (async () => {
      try {
        const response = await authFetch(`/api/v1/user/calculationstore?filename=${encodeURIComponent(filename)}`);
        if (cancelled || handleAuthResponse(response, navigate, location)) return;
        if (!response.ok) throw new Error(response.status === 404 ? str("Calculation not found") : `HTTP ${response.status}`);
        const data = await response.json();
        if (!cancelled) handleLoadData(data);
      } catch (error) {
        if (cancelled) return;
        toaster.push(
          <Message type="error" showIcon closable data-testid="calc-open-error">
            {`${str("Error loading calculation:")} ${error.message}`}
          </Message>,
          { placement: "topCenter", duration: 8000 },
        );
        const url = new URL(window.location);
        url.searchParams.delete("id");
        url.searchParams.delete("stage");
        window.history.replaceState({}, "", url);
      } finally {
        if (!cancelled) setOpeningSaved(false);
      }
    })();
    return () => { cancelled = true; };
  // Open once per id; auth redirect state is read at fetch time.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedId]);

  const handleNext = useCallback((mode) => {
    const calculationId = crypto.randomUUID();
    owner.current = { epoch: owner.current.epoch + 1, calculationId };
    dispatch({ type: "load", data: { carSelectionMode: mode, calculationId } });
    setIsMainMenuStage(false);
  }, []);

  if (openingSaved) return <Loader center size="md" content={str("Loading...")} data-testid="calc-open-loader" />;

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
