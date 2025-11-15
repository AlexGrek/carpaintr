import { useEffect, useState, useCallback } from "react";
import { Button, Divider, Panel, PanelGroup, Tabs } from "rsuite";
import SelectionInput from "../SelectionInput";
import { useMediaQuery } from "react-responsive";
import { authFetch, getOrFetchCompanyInfo } from "../../utils/authFetch"; // Assuming authFetch is used, not authFetchYaml
import "./CarBodyPartsSelector.css";
import { useLocale } from "../../localization/LocaleContext";
import ErrorMessage from "../layout/ErrorMessage";
import "./CarBodyPartsSelector.css";
import { stripExt } from "../../utils/utils";
import {
  evaluate_processor,
  is_supported_repair_type,
  make_sandbox_extensions,
  should_evaluate_processor,
  validate_requirements,
  verify_processor,
} from "../../calc/processor_evaluator";
import CarBodyPartDrawer from "./CarBodyPartDrawer";
import CarDiagram, { buildCarSubcomponentsFromT2 } from "./diagram/CarDiagram";

// Translations for car parts
const carPartsTranslations = {
  Hood: "Капот",
  "Front Bumper": "Передній бампер",
  "Rear Bumper": "Задній бампер",
  "Left Front Door": "Ліві передні двері",
  "Right Front Door": "Праві передні двері",
  "Left Rear Door": "Ліві задні двері",
  "Right Rear Door": "Праві задні двері",
  Trunk: "Багажник",
  "Left Front Fender": "Ліве переднє крило",
  "Right Front Fender": "Праве переднє крило",
};

const CarBodyPartsSelector = ({
  onChange,
  selectedParts,
  calculations,
  setCalculations,
  body,
  carClass,
  partsVisual,
}) => {
  const isMobile = useMediaQuery({ maxWidth: 767 });

  const { str } = useLocale();
  const [errorText, setErrorText] = useState(null);
  const [errorTitle, setErrorTitle] = useState("");

  const [company, setCompany] = useState(null);

  const handleError = useCallback(
    (reason) => {
      console.error(reason);
      const title = str("Error");
      setErrorText(reason);
      setErrorTitle(title);
    },
    [str],
  );

  const mapVisual = useCallback(
    (partName) => {
      // console.log(partName);
      // console.log(partsVisual);
      let entry = partName;
      if (entry && partsVisual[entry]) {
        return partsVisual[entry];
      } else {
        return partsVisual.default;
      }
    },
    [partsVisual],
  );

  // State for available parts fetched from the API
  const [availableParts, setAvailableParts] = useState([]);
  const [availablePartsT2, setAvailablePartsT2] = useState([]);
  // State for parts not yet selected by the user, derived from availableParts
  const [unselectedParts, setUnselectedParts] = useState([]);

  const [processors, setProcessors] = useState([]);
  const [tableDataRepository, setTableDataRepository] = useState({});

  // Local state for the part being currently configured in the drawer
  const [drawerCurrentPart, setDrawerCurrentPart] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);

  const outsideRepairZoneOptions = {
    no: "без пошкоджень",
    slightly: "незначні пошкодження",
    remove: "треба видалити",
  };

  // Effect to update unselectedParts when availableParts changes
  useEffect(() => {
    if (Array.isArray(availableParts)) {
      // Filter out parts that are already in selectedParts
      const currentlySelectedNames = new Set(selectedParts.map((p) => p.name));
      const newUnselected = availableParts
        .map((part) => part["Список деталь укр"])
        .filter((partName) => !currentlySelectedNames.has(partName));
      setUnselectedParts(newUnselected);
    }
    console.log(availableParts);
  }, [availableParts, selectedParts]); // Add selectedParts as a dependency

  // Effect to fetch available car parts from the API
  useEffect(() => {
    const updateCompanyInfo = async () => {
      let info = await getOrFetchCompanyInfo();
      if (info != null) setCompany(info);
    };
    updateCompanyInfo();

    if (carClass == null || body == null) {
      return;
    }

    // Reset availableParts and unselectedParts when carClass or body changes
    setAvailableParts([]);
    setUnselectedParts([]);

    authFetch("/api/v1/user/processors_bundle")
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to fetch plugin bundle: ${response.status}`);
        }
        return response.text();
      })
      .then((code) => {
        const sandbox = { exports: {}, ...make_sandbox_extensions() };
        new Function("exports", code)(sandbox.exports);
        const plugins = sandbox.exports.default.map((p) => verify_processor(p));
        setProcessors(plugins);
        // console.log("Plugins initialized", plugins, jsyaml.dump(JSON.parse(JSON.stringify(sandbox))));
      })
      .catch(handleError);

    authFetch(`/api/v1/user/carparts/${carClass}/${body}`)
      .then((response) => {
        // No navigation logic here, this component should not dictate routing.
        // If 403 occurs, authFetch should handle it (e.g., redirect to login).
        if (!response.ok) {
          console.error(`HTTP error ${response.status}`);
          // Optionally, handle specific errors or show user feedback
          return Promise.reject(
            `Failed to fetch car parts: ${response.status}`,
          );
        }
        return response.json();
      })
      .then((data) => {
        if (data) setAvailableParts(data);
      })
      .catch((err) => {
        console.error("Error fetching car parts:", err);
        handleError("Error fetching car parts: " + err);
      });

    authFetch(`/api/v1/user/carparts_t2/${carClass}/${body}`)
      .then((response) => {
        if (!response.ok) {
          console.error(`HTTP error ${response.status}`);
          // Optionally, handle specific errors or show user feedback
          return Promise.reject(
            `Failed to fetch car parts: ${response.status}`,
          );
        }
        return response.json();
      })
      .then((data) => {
        if (data) setAvailablePartsT2(data);
      })
      .catch((err) => {
        console.error("Error fetching car parts:", err);
        handleError("Error fetching car parts: " + err);
      });
  }, [body, carClass, handleError]); // Dependencies for API fetch

  // Helper to generate initial grid data
  const generateInitialGrid = useCallback((visual) => {
    const rows = visual.y;
    const cols = visual.x;
    const grid = [];
    for (let y = 0; y < rows; y++) {
      const row = [];
      for (let x = 0; x < cols; x++) {
        row.push(visual.unused.includes(`${x},${y}`) ? -1 : 0);
      }
      grid.push(row);
    }
    // console.log("Grid generated for ", JSON.stringify(visual));
    return grid;
  }, []);

  const getOrFetchTableData = useCallback(
    (partName) => {
      if (tableDataRepository[partName] != undefined) {
        return tableDataRepository[partName];
      }
      // fetch
      const params = new URLSearchParams({
        car_class: carClass,
        car_type: body,
        part: partName,
      });
      authFetch(`/api/v1/user/lookup_all_tables?${params}`)
        .then((response) => {
          // No navigation logic here, this component should not dictate routing.
          // If 403 occurs, authFetch should handle it (e.g., redirect to login).
          if (!response.ok) {
            console.error(`HTTP error ${response.status}`);
            // Optionally, handle specific errors or show user feedback
            return Promise.reject(
              `Failed to fetch car parts: ${response.status}`,
            );
          }
          return response.json();
        })
        .then((data) => {
          if (data) {
            const preprocessedTables = data.map((table) => {
              let name = stripExt(table[0]);
              let file = table[0];
              let data = table[1];
              return {
                name,
                data,
                file,
              };
            });
            setTableDataRepository((repo) => {
              return { ...repo, [partName]: preprocessedTables };
            });
          }
        })
        .catch((err) => {
          console.error("Error fetching car parts table data:", err);
          handleError("Error fetching table data: " + err);
        });
      return [];
    },
    [body, carClass, handleError, tableDataRepository],
  );

  useEffect(() => {
    if (drawerCurrentPart) {
      // not null or undefined
      if (tableDataRepository[drawerCurrentPart.name] != undefined) {
        setDrawerCurrentPart((part) => {
          return {
            ...part,
            tableData: tableDataRepository[drawerCurrentPart.name],
          };
        });
      }
    }
  }, [tableDataRepository]);

  // Handler for selecting a new part from the dropdown
  const handlePartSelect = useCallback(
    (partName) => {
      // Check if the part is already in selectedParts (e.g., if re-opening for edit)
      const existingPart = selectedParts.find((p) => p.name === partName);

      const newPart = existingPart
        ? { ...existingPart } // If existing, create a shallow copy to modify
        : {
            action: null,
            replace: false,
            original: true,
            damageLevel: 0,
            name: partName,
            grid: generateInitialGrid(mapVisual(partName ? partName : "")),
            outsideRepairZone: null,
            tableData: getOrFetchTableData(partName),
          };

      setDrawerCurrentPart(newPart);
      setIsDrawerOpen(true);
    },
    [selectedParts, generateInitialGrid, mapVisual, getOrFetchTableData],
  );

  // Handler for updating the local drawerCurrentPart state
  const updateDrawerCurrentPart = useCallback((updates) => {
    setDrawerCurrentPart((prevPart) => {
      const updatedPart = { ...prevPart, ...updates };
      return updatedPart;
    });
  }, []);

  // Handler for adding/updating a part to the global selectedParts
  const handleAddOrUpdatePart = useCallback(() => {
    if (!drawerCurrentPart) return;

    const updatedSelectedParts = selectedParts.map((part) =>
      part.name === drawerCurrentPart.name ? drawerCurrentPart : part,
    );

    // If the part was not found (it's a new addition), add it
    const isNewPart = !selectedParts.some(
      (part) => part.name === drawerCurrentPart.name,
    );
    if (isNewPart) {
      updatedSelectedParts.push(drawerCurrentPart);
    }

    onChange(updatedSelectedParts);
    setIsDrawerOpen(false);
    setDrawerCurrentPart(null); // Clear local state after committing
  }, [selectedParts, drawerCurrentPart, onChange]);

  // Handler for unselecting a part (removing from global selectedParts)
  const handlePartUnselect = useCallback(
    (partToRemove) => {
      // Confirmed to remove based on `partToRemove.name`
      onChange(selectedParts.filter((p) => p.name !== partToRemove.name));
    },
    [selectedParts, onChange],
  );

  // Handler for closing the drawer (resets local state)
  const handleDrawerClose = useCallback(() => {
    setIsDrawerOpen(false);
    setDrawerCurrentPart(null); // Clear local state when drawer is closed without submitting
  }, []);

  useEffect(() => {
    if (
      drawerCurrentPart &&
      isCalculating &&
      company &&
      drawerCurrentPart.tableData
    ) {
      console.log(drawerCurrentPart.tableData);
      const tdata = drawerCurrentPart.tableData.reduce((acc, item) => {
        acc[item.name] = item.data;
        return acc;
      }, {});
      const stuff = {
        name: drawerCurrentPart.name,
        repairAction: drawerCurrentPart.action,
        files: [],
        carClass: carClass,
        carBodyType: body,
        carYear: 1999,
        carModel: {},
        tableData: tdata,
        paint: {}, // TODO: make it useful
        pricing: company.pricing_preferences,
        carPart: drawerCurrentPart,
      };

      let processorsEvaluated = processors.map((proc) => {
        let missing = validate_requirements(proc, tdata);
        if (missing == null) {
          if (
            is_supported_repair_type(proc, stuff.repairAction) &&
            should_evaluate_processor(proc, stuff)
          ) {
            return evaluate_processor(proc, stuff);
          } else {
            return "Condition not met to run processor " + proc.name;
          }
        }
        return `Data not ready (${missing} is missing): ${JSON.stringify(tdata, null, 2)}`;
      });
      setCalculations({
        ...calculations,
        [drawerCurrentPart.name]: processorsEvaluated.filter(
          (item) => typeof item !== "string",
        ),
      });
    }
  }, [
    drawerCurrentPart,
    carClass,
    body,
    processors,
    isCalculating,
    company,
    setCalculations,
  ]);

  return (
    <div className="car-body-parts-selector">
      <div className="car-container-container">
        <ErrorMessage
          errorText={errorText}
          onClose={() => setErrorText(null)}
          title={errorTitle}
        />
        <Tabs defaultActiveKey="1" appearance="pills">
          <Tabs.Tab eventKey="1" title={str("Car diagram")}>
            <CarDiagram
              partSubComponents={buildCarSubcomponentsFromT2(availablePartsT2)}
            />
          </Tabs.Tab>
          <Tabs.Tab eventKey="2" title={str("Major parts")}>
            <div>
              <div className="pop-in-simple" style={{ maxWidth: "500pt" }}>
                {/* Only show SelectionInput if there are unselected parts */}
                {unselectedParts.length > 0 && (
                  <SelectionInput
                    name="Додати запчастини"
                    labels={carPartsTranslations}
                    values={unselectedParts}
                    selectedValue={null}
                    onChange={handlePartSelect}
                    autoConfirm={false}
                  />
                )}
              </div>
            </div>
          </Tabs.Tab>
        </Tabs>
      </div>

      <CarBodyPartDrawer
        isDrawerOpen={isDrawerOpen}
        handleDrawerClose={handleDrawerClose}
        drawerCurrentPart={drawerCurrentPart}
        updateDrawerCurrentPart={updateDrawerCurrentPart}
        handleAddOrUpdatePart={handleAddOrUpdatePart}
        calculations={calculations}
        setCalculations={setCalculations}
        company={company}
        isMobile={isMobile}
        mapVisual={mapVisual}
        outsideRepairZoneOptions={outsideRepairZoneOptions}
        processors={processors}
        carClass={carClass}
        body={body}
        onSetIsCalculating={setIsCalculating}
      />

      <div>
        <Divider />
        <PanelGroup>
          {Array.isArray(selectedParts) && selectedParts.length > 0 ? (
            selectedParts.map((part) => (
              <Panel
                style={{
                  display: "inline-block",
                  width: 240,
                  margin: "1em",
                  cursor: "pointer",
                }}
                header={carPartsTranslations[part.name] || part.name} // Use translation if available
                key={part.name}
                shaded
                bordered
                onClick={() => handlePartSelect(part.name)} // Click to re-edit
              >
                <p style={{ fontSize: "10px", color: "#666" }}>
                  (Клікніть, щоб редагувати)
                </p>
                <Button
                  size="xs"
                  color="red"
                  appearance="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePartUnselect(part);
                  }}
                  style={{ marginTop: "5px" }}
                >
                  Видалити
                </Button>
              </Panel>
            ))
          ) : (
            <p>Ще немає обраних запчастин. Оберіть зі списку вище.</p>
          )}
        </PanelGroup>
      </div>
    </div>
  );
};

export default CarBodyPartsSelector;
