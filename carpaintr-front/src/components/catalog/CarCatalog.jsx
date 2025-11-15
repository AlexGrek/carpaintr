import { useCallback, useEffect, useState } from "react";
import {
  useLocale,
  registerTranslations,
} from "../../localization/LocaleContext";
import { authFetch } from "../../utils/authFetch";
import ErrorMessage from "../layout/ErrorMessage";
import { capitalizeFirstLetter } from "../../utils/utils";
import SelectionInput from "../SelectionInput";
import CarDataDisplay from "./CarDataDisplay";

// Register translations for Ukrainian language
registerTranslations("ua", {
  Error: "Помилка",
  Make: "Марка",
  "Select Make": "Виберіть марку",
});

const CarCatalog = () => {
  const [makes, setMakes] = useState([]);
  const [errorText, setErrorText] = useState(null);
  const [errorTitle, setErrorTitle] = useState("");
  const [models, setModels] = useState({});
  const [selectedMake, setSelectedMake] = useState(null);
  const { str } = useLocale();

  const handleError = useCallback(
    (reason) => {
      console.error(reason);
      const title = str("Error"); // Use str for translation
      setErrorText(reason);
      setErrorTitle(title);
    },
    [str],
  );

  useEffect(() => {
    authFetch("/api/v1/user/carmakes")
      .then((response) => {
        if (response.status === 403) {
          // navigate("/cabinet");
          handleError("ERROR");
          return null; // Stop here, don't try to parse JSON
        }
        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        if (data) setMakes(data); // Only set if data was parsed
      })
      .catch(handleError);
  }, [handleError]);

  useEffect(() => {
    setModels([]);
    if (selectedMake === null) {
      return;
    }
    authFetch(`/api/v1/user/carmodels/${selectedMake}`)
      .then((response) => response.json())
      .then(setModels)
      .catch(console.error);
  }, [selectedMake]);

  return (
    <div className="fade-in-simple">
      <ErrorMessage
        errorText={errorText}
        onClose={() => setErrorText(null)}
        title={errorTitle}
      />
      <SelectionInput
        mode="select"
        name={str("Make")}
        values={makes}
        labelFunction={capitalizeFirstLetter}
        selectedValue={selectedMake}
        onChange={(value) => setSelectedMake(value)}
        placeholder={str("Select Make")}
      />
      {selectedMake != null && models != null && (
        <div className="fade-in-simple">
          <CarDataDisplay data={models} make={selectedMake} />
        </div>
      )}
    </div>
  );
};

export default CarCatalog;
