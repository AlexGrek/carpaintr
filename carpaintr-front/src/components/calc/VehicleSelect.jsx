/* eslint-disable react/display-name */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale } from "../../localization/LocaleContext";
import { useNavigate } from "react-router-dom";
import { isArray, isObjectLike } from "lodash";
import { authFetch, authFetchYaml } from "../../utils/authFetch";
import { handleLicenseForbidden } from "../../utils/licenseRedirect";
import ErrorMessage from "../layout/ErrorMessage";
import { SelectPicker } from "rsuite";
import ImagePickerGrid from "../layout/ImagePickerGrid";
import SearchSelectInput from "../layout/SearchSelectInput";
import ChipPicker from "../layout/ChipPicker";
import StageSection from "../layout/StageSection";
import { Calendar, Car, CarFront, Shapes, Tag } from "lucide-react";
import VinDecoderPanel from "./VinDecoderPanel";

// Pre-map static lists for SelectPicker data to avoid re-mapping on every render
const CAR_CLASS_OPTIONS = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "SUV 1",
  "SUV 2",
  "SUV MAX",
].map((i) => ({ label: i, value: i }));

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [...Array(40)].map((_, i) => {
  const y = `${CURRENT_YEAR - i}`;
  return { label: y, value: y };
});
const YEAR_VALUES = YEAR_OPTIONS.map((o) => o.value);

const VehicleSelect = React.memo(
  ({
    selectModelMode,
    setSelectModelMode,
    selectedBodyType,
    vin,
    setVin,
    setBodyType,
    selectedMake,
    selectedModel,
    year,
    setMake,
    setModel,
    setYear,
    carclass,
    setCarClass,
    autoOpenVin,
  }) => {
    const [makes, setMakes] = useState([]);
    const [bodyPartsClassMapping, setBodyPartsClassMapping] = useState(null);
    const [carBodyTypesOptions, setCarBodyTypesOptions] = useState([]);
    const [models, setModels] = useState({});
    // Make whose models are currently in `models` (guards against stale lists)
    const [modelsMake, setModelsMake] = useState(null);
    const { str } = useLocale();
    const navigate = useNavigate();

    const [vinDecoderOpen, setVinDecoderOpen] = useState(!!autoOpenVin);
    const [errorTitle, setErrorTitle] = useState("");
    const [errorText, setErrorText] = useState(null);

    useEffect(() => {
      if (autoOpenVin) {
        setVinDecoderOpen(true);
      }
    }, [autoOpenVin]);

    const handleError = useCallback(
      (reason) => {
        console.error(reason);
        const title = str("Error");
        setErrorText(reason);
        setErrorTitle(title);
      },
      [str],
    );

    const getCarBodyTypeOptions = useCallback(
      (carclass, bodyPartsClassMapping) => {
        if (bodyPartsClassMapping == null || !carclass) {
          return [];
        }
        if (!bodyPartsClassMapping || !isObjectLike(bodyPartsClassMapping)) {
          handleError(
            "Wrong type in getCarBodyTypeOptions: " +
              JSON.stringify(bodyPartsClassMapping),
          );
          return [];
        }
        if (!Object.hasOwn(bodyPartsClassMapping, carclass)) {
          handleError(
            `Cannot find key for ${carclass} in getCarBodyTypeOptions: ` +
              JSON.stringify(bodyPartsClassMapping),
          );
          return [];
        }
        if (!isArray(bodyPartsClassMapping[carclass])) {
          handleError(
            `Error for ${carclass} in getCarBodyTypeOptions: ` +
              JSON.stringify(bodyPartsClassMapping[carclass]),
          );
          return [];
        }
        return bodyPartsClassMapping[carclass];
      },
      [handleError],
    );

    useEffect(() => {
      const variants = getCarBodyTypeOptions(carclass, bodyPartsClassMapping);
      const options = variants.map((opt) => ({ label: str(opt), value: opt }));
      setCarBodyTypesOptions(options);
      if (
        selectedBodyType != null &&
        variants.length > 0 &&
        !variants.includes(selectedBodyType)
      ) {
        if (selectedModel != null) {
          // unsupported class
          handleError(
            `Unsupported body type '${str(selectedBodyType)}' for ${carclass} class`,
          );
        } else {
          setBodyType(null); // impossible (or unsupported) body type for this class
        }
      }
    }, [
      bodyPartsClassMapping,
      carclass,
      getCarBodyTypeOptions,
      handleError,
      selectedBodyType,
      selectedModel,
      setBodyType,
      str,
    ]);

    useEffect(() => {
      authFetch("/api/v1/user/carmakes")
        .then((response) => {
          if (handleLicenseForbidden(navigate, response)) {
            return null;
          }
          if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
          }
          return response.json();
        })
        .then((data) => {
          // Only set if data was parsed
          if (isArray(data)) {
            setMakes([...data].sort((a, b) => a.localeCompare(b)));
          }
        })
        .catch(handleError);
    }, [navigate, handleError]);

    useEffect(() => {
      authFetchYaml(
        "/api/v1/user/list_class_body_types",
        (onerror = handleError),
      )
        .then((data) => {
          if (data) setBodyPartsClassMapping(data); // Only set if data was parsed
        })
        .catch(handleError);
    }, [handleError]);

    useEffect(() => {
      if (selectedMake === null) {
        return;
      }
      let cancelled = false;
      authFetch(`/api/v1/user/carmodels/${selectedMake}`)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
          }
          return response.json();
        })
        .catch((reason) => {
          console.error(reason);
          return {}; // no catalog for this make — custom model entry still works
        })
        .then((data) => {
          if (cancelled) return;
          setModels(isObjectLike(data) ? data : {});
          setModelsMake(selectedMake);
        });
      return () => {
        cancelled = true;
      };
    }, [selectedMake]);

    const formatModelName = (name) => {
      return name.replace(/\b[a-z0-9]+\b/gi, (word) => {
        if (/^[a-z]+$/.test(word) && word.length > 2) {
          return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        }
        return word.toUpperCase();
      });
    };

    const modelOptions = useMemo(
      () => Object.keys(models).sort().map(m => ({ value: m, label: formatModelName(m) })),
      [models]
    );

    const modelsLoaded = selectedMake !== null && modelsMake === selectedMake;
    const catalogModel =
      modelsLoaded && selectedModel !== null && Object.hasOwn(models, selectedModel)
        ? models[selectedModel]
        : null;
    // Model typed by the user that isn't in our catalog (new/rare models)
    const isCustomModel =
      modelsLoaded && selectedModel !== null && catalogModel === null;

    const allBodyTypes = useMemo(() => {
      if (!isObjectLike(bodyPartsClassMapping)) return [];
      return [
        ...new Set(
          Object.values(bodyPartsClassMapping).filter(isArray).flat(),
        ),
      ].sort();
    }, [bodyPartsClassMapping]);

    const bodyTypes = isCustomModel
      ? allBodyTypes
      : isArray(catalogModel?.euro_body_types)
        ? catalogModel.euro_body_types
        : [];

    // For custom models the class is unknown: offer classes supporting the chosen body type
    const customClassOptions = useMemo(() => {
      if (!isCustomModel || !selectedBodyType) return [];
      if (!isObjectLike(bodyPartsClassMapping)) return [];
      return Object.keys(bodyPartsClassMapping)
        .filter(
          (cls) =>
            isArray(bodyPartsClassMapping[cls]) &&
            bodyPartsClassMapping[cls].includes(selectedBodyType),
        )
        .sort();
    }, [isCustomModel, selectedBodyType, bodyPartsClassMapping]);

    useEffect(() => {
      if (
        customClassOptions.length === 1 &&
        carclass !== customClassOptions[0]
      ) {
        setCarClass(customClassOptions[0]);
      }
    }, [customClassOptions, carclass, setCarClass]);

    const handleMakeSelect = useCallback(
      (make) => {
        if (make !== selectedMake) {
          setModel(null);
          setBodyType(null);
          setCarClass(null);
        }
        setMake(make);
      },
      [selectedMake, setMake, setModel, setBodyType, setCarClass],
    );

    const handleModelSelect = useCallback(
      (model, isCustom) => {
        setModel(model);
        setBodyType(null);
        if (!isCustom && model !== null && Object.hasOwn(models, model)) {
          setCarClass(models[model]["euro_class"] ?? null);
          const types = models[model]["euro_body_types"];
          if (isArray(types) && types.length === 1) {
            setBodyType(types[0]);
          }
        } else {
          setCarClass(null);
        }
      },
      [setModel, models, setCarClass, setBodyType],
    );

    const handleBodyTypeSelect = useCallback(
      (type) => {
        setBodyType(type);
        // Custom model: drop a previously chosen class that doesn't support this body type
        if (
          isCustomModel &&
          carclass &&
          !(
            isObjectLike(bodyPartsClassMapping) &&
            isArray(bodyPartsClassMapping[carclass]) &&
            bodyPartsClassMapping[carclass].includes(type)
          )
        ) {
          setCarClass(null);
        }
      },
      [isCustomModel, carclass, bodyPartsClassMapping, setBodyType, setCarClass],
    );

    const handleVinApply = useCallback(
      ({ make, model, modelInfo, year: decodedYear }) => {
        setSelectModelMode(true);
        setMake(make);
        setModel(model);
        setCarClass(modelInfo?.euro_class ?? null);
        const types = modelInfo?.euro_body_types;
        setBodyType(isArray(types) && types.length === 1 ? types[0] : null);
        if (decodedYear) {
          setYear(decodedYear);
        }
        setVinDecoderOpen(false);
      },
      [setSelectModelMode, setMake, setModel, setCarClass, setBodyType, setYear],
    );

    const linkClass = "font-medium text-blue-600 hover:text-blue-700";

    return (
      <div>
        <ErrorMessage
          errorText={errorText}
          onClose={() => setErrorText(null)}
          title={errorTitle}
        />
        <div className="flex w-full flex-col gap-3">
          {vinDecoderOpen && (
            <VinDecoderPanel
              vin={vin}
              setVin={setVin}
              makes={makes}
              years={YEAR_VALUES}
              formatModel={formatModelName}
              onApply={handleVinApply}
              onClose={() => setVinDecoderOpen(false)}
            />
          )}
          {!vinDecoderOpen && selectModelMode && (
            <>
              <StageSection icon={Car} title={str("Make")}>
                <ImagePickerGrid
                  items={makes.map((make) => ({
                    value: make,
                    label: formatModelName(make),
                    image: `/brands/${make}.jpg`,
                  }))}
                  onSelect={handleMakeSelect}
                  value={selectedMake}
                  testId="calc-vehicle-make-select"
                  collapseOnSelect
                  changeLabel={str("Change")}
                />
                {!selectedMake && !selectedModel && (
                  <p className="mt-3 text-xs text-slate-500">
                    Оберіть модель автомобіля або{" "}
                    <a
                      href="#"
                      className={linkClass}
                      onClick={() => setSelectModelMode(false)}
                      data-testid="calc-vehicle-switch-to-class-mode-link"
                    >
                      вкажіть тип вручну
                    </a>{" "}
                    чи{" "}
                    <a
                      href="#"
                      className={linkClass}
                      onClick={() => setVinDecoderOpen(true)}
                      data-testid="calc-vehicle-open-vin-decoder-link"
                    >
                      декодуйте VIN
                    </a>
                    .
                  </p>
                )}
              </StageSection>
              {selectedMake !== null && (
                <StageSection icon={Tag} title={str("Model")}>
                  <SearchSelectInput
                    items={modelOptions}
                    value={selectedModel}
                    onChange={handleModelSelect}
                    placeholder={str("Search or enter model")}
                    customOptionLabel={(text) =>
                      `${str("Use")} "${text}" (${str("not in the list")})`
                    }
                    customSelectedHint={str(
                      "Model not in the list — all body types available",
                    )}
                    emptyText={str("No models found")}
                    changeLabel={str("Change")}
                    testId="calc-vehicle-model-select"
                  />
                </StageSection>
              )}
              {selectedModel !== null && (
                <StageSection icon={CarFront} title={str("Body Type")}>
                  <ImagePickerGrid
                    items={bodyTypes.map((type) => ({
                      value: type,
                      label: str(type),
                      image: `/body_types/${type}.jpg`,
                    }))}
                    onSelect={handleBodyTypeSelect}
                    value={selectedBodyType}
                    testId="calc-vehicle-body-type-select"
                  />
                  {customClassOptions.length > 0 && (
                    <div className="mt-4">
                      <div className="mb-2 text-xs font-medium text-slate-600">
                        {str("Class")}
                      </div>
                      <ChipPicker
                        items={customClassOptions}
                        onSelect={setCarClass}
                        value={carclass}
                        testId="calc-vehicle-custom-class-picker"
                      />
                    </div>
                  )}
                </StageSection>
              )}
            </>
          )}
          {!vinDecoderOpen && !selectModelMode && (
            <>
              <StageSection icon={Shapes} title={str("Class")}>
                <ChipPicker
                  items={CAR_CLASS_OPTIONS}
                  onSelect={setCarClass}
                  value={carclass}
                  testId="calc-vehicle-class-picker"
                />
                {!carclass && (
                  <div className="mt-3 flex flex-col gap-1 text-xs text-slate-500">
                    <p>
                      Оберіть тип автомобіля або{" "}
                      <a
                        href="#"
                        className={linkClass}
                        onClick={() => setSelectModelMode(true)}
                        data-testid="calc-vehicle-switch-to-model-mode-link"
                      >
                        модель
                      </a>
                      .
                    </p>
                    <p>
                      Спробувати{" "}
                      <a
                        href="#"
                        className={linkClass}
                        onClick={() => setVinDecoderOpen(true)}
                        data-testid="calc-vehicle-open-vin-decoder-link"
                      >
                        декодувати VIN код
                      </a>
                      .
                    </p>
                  </div>
                )}
              </StageSection>
              {carclass && (
                <StageSection icon={CarFront} title={str("Body Type")}>
                  <ImagePickerGrid
                    items={carBodyTypesOptions.map((opt) => ({
                      value: opt.value,
                      label: opt.label,
                      image: `/body_types/${opt.value}.jpg`,
                    }))}
                    onSelect={setBodyType}
                    value={selectedBodyType}
                    testId="calc-vehicle-body-type-picker"
                  />
                </StageSection>
              )}
            </>
          )}
          {!vinDecoderOpen &&
            (selectedModel !== null ||
              (carclass !== null && selectedBodyType !== null)) && (
            <StageSection icon={Calendar} title={str("Year of manufacture")}>
              <SelectPicker
                data={YEAR_OPTIONS}
                onSelect={setYear}
                value={year}
                placeholder={str("Year of manufacture")}
                searchable={false}
                block
                data-testid="calc-vehicle-year-select"
              />
            </StageSection>
          )}
        </div>
      </div>
    );
  },
);

export default VehicleSelect;
