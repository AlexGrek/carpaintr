import { useEffect, useMemo, useState } from "react";
import { Button, Loader } from "rsuite";
import { CircleAlert, Globe, ScanLine, X } from "lucide-react";
import { isObjectLike } from "lodash";
import { authFetch } from "../../utils/authFetch";
import { useLocale } from "../../localization/LocaleContext";
import StageSection from "../layout/StageSection";
import {
  decodeVinPartial,
  fetchNhtsaVin,
  matchCatalogMake,
  matchCatalogModel,
  normalizeVinInput,
  vinModelSlug,
  VIN_LENGTH,
} from "../../vindecoder";

// VIN structure: WMI (manufacturer) · VDS (model/chassis) · VIS (year, plant, serial)
const SEGMENTS = [
  { len: 3, label: "Manufacturer" },
  { len: 6, label: "Model" },
  { len: 8, label: "Year & serial" },
];

const Badge = ({ tone, children }) => (
  <span
    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
      tone === "ok"
        ? "bg-emerald-50 text-emerald-700"
        : "bg-slate-100 text-slate-500"
    }`}
  >
    {children}
  </span>
);

const ResultRow = ({ label, value, hint, badge, media, testId }) => (
  <div
    className="flex min-h-12 items-center gap-3 border-b border-slate-100 py-2 last:border-b-0"
    data-testid={testId}
  >
    <div className="w-20 shrink-0 text-xs font-medium text-slate-500">
      {label}
    </div>
    {value ? (
      <div className="pop-in-simple flex min-w-0 flex-1 items-center gap-2">
        {media}
        <span
          className="truncate text-base font-semibold text-slate-900"
          data-testid={testId ? `${testId}-value` : undefined}
        >
          {value}
        </span>
        {badge}
      </div>
    ) : (
      <div className="flex-1 text-sm text-slate-400">{hint}</div>
    )}
  </div>
);

const Notice = ({ children }) => (
  <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
    <CircleAlert size={14} className="mt-px shrink-0" />
    <span>{children}</span>
  </div>
);

/**
 * Live VIN decoder: brand/model/year appear as soon as enough characters are
 * typed (decoded locally from the VIN structure); a complete VIN is also
 * checked against the NHTSA database. `onApply` receives catalog keys.
 */
const VinDecoderPanel = ({
  vin,
  setVin,
  makes = [],
  years = [],
  formatModel = (model) => model,
  onApply,
  onClose,
}) => {
  const { str } = useLocale();
  const [modelsByMake, setModelsByMake] = useState({});
  const [online, setOnline] = useState({ vin: null, status: "idle", result: null });

  const local = useMemo(() => decodeVinPartial(vin), [vin]);
  const lookupVin =
    local.complete && local.invalidChars.length === 0 ? local.vin : null;

  useEffect(() => {
    if (!lookupVin) return;
    const controller = new AbortController();
    setOnline({ vin: lookupVin, status: "loading", result: null });
    fetchNhtsaVin(lookupVin, controller.signal)
      .then((result) =>
        setOnline({ vin: lookupVin, status: result ? "found" : "notFound", result }),
      )
      .catch((error) => {
        if (error.name !== "AbortError") {
          setOnline({ vin: lookupVin, status: "notFound", result: null });
        }
      });
    return () => controller.abort();
  }, [lookupVin]);

  const onlineStatus = online.vin === lookupVin ? online.status : "idle";
  const onlineResult = onlineStatus === "found" ? online.result : null;

  const catalogMake =
    matchCatalogMake(onlineResult?.make, makes) ??
    matchCatalogMake(local.make, makes);
  const makeLabel = local.make ?? onlineResult?.make ?? null;

  useEffect(() => {
    if (!catalogMake || modelsByMake[catalogMake]) return;
    let cancelled = false;
    authFetch(`/api/v1/user/carmodels/${catalogMake}`)
      .then((response) => (response.ok ? response.json() : {}))
      .catch(() => ({}))
      .then((data) => {
        if (cancelled) return;
        setModelsByMake((prev) => ({
          ...prev,
          [catalogMake]: isObjectLike(data) ? data : {},
        }));
      });
    return () => {
      cancelled = true;
    };
  }, [catalogMake, modelsByMake]);

  const catalogModels = catalogMake ? modelsByMake[catalogMake] : null;
  const catalogModelKeys = catalogModels ? Object.keys(catalogModels) : [];
  const decodedModel = onlineResult?.model ?? local.model;
  const catalogModel =
    matchCatalogModel(onlineResult?.model, catalogModelKeys) ??
    matchCatalogModel(local.model, catalogModelKeys);

  const year = onlineResult?.year || local.year;

  const handleApply = () => {
    onApply?.({
      make: catalogMake,
      model: catalogModel ?? vinModelSlug(decodedModel),
      modelInfo: catalogModel ? catalogModels[catalogModel] : null,
      year: years.includes(year) ? year : null,
    });
  };

  let offset = 0;

  return (
    <StageSection
      icon={ScanLine}
      title={str("VIN decoder")}
      testId="calc-vehicle-vin-decoder"
      action={
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label={str("Close")}
          data-testid="calc-vehicle-vin-close-button"
        >
          <X size={16} />
        </button>
      }
    >
      <div className="relative">
        <input
          value={vin}
          onChange={(e) => setVin(normalizeVinInput(e.target.value))}
          placeholder="WVWZZZ1JZXW000001"
          autoFocus
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-3 pr-16 font-mono text-lg tracking-[0.12em] text-slate-900 outline-none placeholder:text-slate-300 focus:border-blue-500 focus:ring-[3px] focus:ring-blue-500/15"
          data-testid="calc-vehicle-vin-input"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs tabular-nums text-slate-400">
          {vin.length}/{VIN_LENGTH}
        </span>
      </div>

      <div className="mt-2 flex gap-1">
        {SEGMENTS.map((segment) => {
          const filled =
            Math.min(Math.max(vin.length - offset, 0), segment.len) / segment.len;
          offset += segment.len;
          return (
            <div key={segment.label} style={{ flex: segment.len }}>
              <div className="h-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all duration-200"
                  style={{ width: `${filled * 100}%` }}
                />
              </div>
              <div className="mt-1 truncate text-[10px] text-slate-400">
                {str(segment.label)}
              </div>
            </div>
          );
        })}
      </div>

      {local.invalidChars.length > 0 && (
        <Notice>
          {str("VIN cannot contain")}: {local.invalidChars.join(", ")}
        </Notice>
      )}

      <div className="mt-3">
        <ResultRow
          label={str("Make")}
          value={makeLabel}
          hint={
            vin.length < 3 ? str("Type the first 3 characters") : str("Not recognized")
          }
          media={
            catalogMake && (
              <img
                src={`/brands/${catalogMake}.jpg`}
                alt=""
                className="h-7 w-7 shrink-0 rounded-md object-contain ring-1 ring-slate-200"
              />
            )
          }
          badge={!catalogMake && <Badge>{str("Not in catalog")}</Badge>}
          testId="calc-vehicle-vin-make"
        />
        <ResultRow
          label={str("Model")}
          value={
            catalogModel || decodedModel
              ? formatModel(catalogModel ?? decodedModel)
              : null
          }
          hint={
            !makeLabel
              ? "—"
              : vin.length < 8
                ? str("Needs more characters")
                : str("Not recognized — choose after applying")
          }
          badge={
            catalogMake &&
            (catalogModel ? (
              <Badge tone="ok">{str("In catalog")}</Badge>
            ) : (
              <Badge>{str("Not in catalog")}</Badge>
            ))
          }
          testId="calc-vehicle-vin-model"
        />
        <ResultRow
          label={str("Year")}
          value={year}
          hint={vin.length < 10 ? str("10th character") : str("Not recognized")}
          testId="calc-vehicle-vin-year"
        />
      </div>

      {onlineStatus !== "idle" && (
        <div
          className="mt-2 flex items-center gap-2 text-xs text-slate-500"
          data-testid="calc-vehicle-vin-online-status"
        >
          {onlineStatus === "loading" ? (
            <>
              <Loader size="xs" />
              {str("Checking online database…")}
            </>
          ) : (
            <>
              <Globe
                size={14}
                className={
                  onlineStatus === "found" ? "text-emerald-600" : "text-slate-400"
                }
              />
              {onlineStatus === "found"
                ? str("Confirmed by NHTSA database")
                : str("Not found online — decoded from VIN structure")}
            </>
          )}
        </div>
      )}

      {makeLabel && !catalogMake && (
        <Notice>{str("Brand is not in the catalog — choose the car type manually")}</Notice>
      )}

      <div className="mt-4 flex items-center justify-between gap-2">
        <Button
          appearance="subtle"
          onClick={onClose}
          data-testid="calc-vehicle-vin-manual-button"
        >
          {str("Choose manually")}
        </Button>
        <Button
          appearance="primary"
          color="blue"
          disabled={!catalogMake}
          onClick={handleApply}
          data-testid="calc-vehicle-vin-apply-button"
        >
          {str("Use this car")}
        </Button>
      </div>
    </StageSection>
  );
};

export default VinDecoderPanel;
