import React, { useState, useEffect } from "react";
import { authFetch } from "../utils/authFetch";
import decodeJwtData from "../utils/jwtutils";
import { List, Button, Divider, Loader } from "rsuite";
import LicenseVisualize from "./LicenseVisualize";
import Trans from "../localization/Trans";
import { useLocale, registerTranslations } from "../localization/LocaleContext"; // Import useLocale and registerTranslations
import "./LicenseManager.css"; // Import the new CSS file
import ErrorMessage from "./layout/ErrorMessage";
import NotifyMessage from "./layout/NotifyMessage";
import SelectionInput from "./SelectionInput";

registerTranslations("ua", {
  "Loading...": "Завантаження...",
  "Error: ": "Помилка: ",
  "Message: ": "Повідомлення: ",
  Licenses: "Ліцензії",
  "No licenses found": "Ліцензій не знайдено",
  "Delete license file": "Видалити файл ліцензії",
  "Generate New License": "Згенерувати нову ліцензію",
  "User Email": "Електронна пошта користувача",
  "Expiration Setting": "Налаштування терміну дії",
  "By Days": "За кількістю днів",
  "By Specific Date": "За конкретною датою",
  "Days from now": "Днів від сьогодні",
  "Expiry Date (UTC)": "Дата закінчення (UTC)",
  "Enter date and time in UTC.": "Введіть дату та час у форматі UTC.",
  "Generate License": "Згенерувати ліцензію",
  "Unauthorized. Please log in again.":
    "Несанкціонований доступ. Будь ласка, увійдіть знову.",
  "Cannot find license": "Не вдається знайти ліцензію",
  "Failed to fetch license:": "Не вдалося отримати ліцензію:",
  "Error fetching details": "Помилка отримання деталей",
  "Failed to fetch licenses:": "Не вдалося отримати ліцензії:",
  "Are you sure you want to delete the license file:":
    "Ви впевнені, що хочете видалити файл ліцензії:",
  "User cancelled deletion": "Користувач скасував видалення",
  "deleted successfully.": "успішно видалено.",
  "Failed to delete license:": "Не вдалося видалити ліцензію:",
  "Error deleting license:": "Помилка видалення ліцензії:",
  "Invalid date format.": "Невірний формат дати.",
  "Failed to generate license:": "Не вдалося згенерувати ліцензію:",
  "License generated successfully:": "Ліцензію успішно згенеровано:",
  "Error generating license:": "Помилка генерування ліцензії:",
  "License level": "Рівень ліцензії",
});

const LicenseManager = ({ userEmail }) => {
  const [licenses, setLicenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [generateType, setGenerateType] = useState("days");
  const [generateLicenseLevel, setGenerateLicenseLevel] = useState("Basic");
  const [days, setDays] = useState(365);
  const [expiryDate, setExpiryDate] = useState("");
  const [message, setMessage] = useState("");
  const { str } = useLocale();
  const API_BASE_URL = "/api/v1/admin";

  const fetchLicenseTokenData = React.useCallback(
    async (filepath) => {
      setError(null);
      try {
        // Use the provided authFetch utility
        const response = await authFetch(
          `${API_BASE_URL}/license/${encodeURIComponent(userEmail)}/${encodeURIComponent(filepath)}`,
        );
        if (!response.ok) {
          // Handle non-OK responses, e.g., unauthorized, not found
          if (response.status === 401) {
            setError(str("Unauthorized. Please log in again."));
          } else if (response.status === 404) {
            setError(`${str("Cannot find license")} ${filepath}`);
          } else {
            const errorText = await response.text();
            throw new Error(
              `${str("Failed to fetch license:")} ${response.status} ${response.statusText} - ${errorText}`,
            );
          }
        } else {
          const data = await response.text();
          const expiration = decodeJwtData(data); // Assuming data is the token

          return expiration;
        }
      } catch (detailError) {
        console.error(`Error fetching details for ${filepath}:`, detailError);
        return str("Error fetching details");
      }
    },
    [str, userEmail],
  );

  const fetchLicenses = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Use the provided authFetch utility
      const response = await authFetch(
        `${API_BASE_URL}/license/list/${encodeURIComponent(userEmail)}`,
      );

      if (!response.ok) {
        // Handle non-OK responses, e.g., unauthorized, not found
        if (response.status === 401) {
          // Redirect to login or handle unauthorized
          // logout(); // Example: log out if unauthorized
          setError(str("Unauthorized. Please log in again."));
        } else if (response.status === 404) {
          setLicenses([]); // No licenses found is not an error, just empty list
        } else {
          const errorText = await response.text();
          throw new Error(
            `${str("Failed to fetch licenses:")} ${response.status} ${response.statusText} - ${errorText}`,
          );
        }
      } else {
        const data = await response.json();
        // Assuming the API returns an array of license filenames (strings)
        // We need to fetch the content of each license to decode the expiry date
        const licenseDetails = await Promise.all(
          data.map(async (filename) => {
            try {
              const expiration = await fetchLicenseTokenData(filename); // Assuming filename is the token

              return { filename, data: expiration };
            } catch (detailError) {
              console.error(
                `Error fetching details for ${filename}:`,
                detailError,
              );
              return { filename, expiration: str("Error fetching details") };
            }
          }),
        );
        setLicenses(licenseDetails);
      }
    } catch (err) {
      setError(err.message);
      console.error("Error fetching licenses:", err);
    } finally {
      setLoading(false);
    }
  }, [fetchLicenseTokenData, str, userEmail]);

  // Fetch licenses when the component mounts or userEmail changes
  useEffect(() => {
    if (userEmail) {
      fetchLicenses();
    } else {
      setLicenses([]); // Clear licenses if no user email is provided
      setLoading(false);
    }
  }, [userEmail, str, fetchLicenses]); // Dependency array includes userEmail and str

  // Function to handle license deletion
  const handleDeleteLicense = async (filename) => {
    if (
      !window.confirm(
        `${str("Are you sure you want to delete the license file:")} ${filename}?`,
      )
    ) {
      return; // User cancelled deletion
    }

    try {
      // Use the provided authFetch utility for DELETE request
      const response = await authFetch(
        `${API_BASE_URL}/license/${encodeURIComponent(userEmail)}/${encodeURIComponent(filename)}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        if (response.status === 401) {
          setError(str("Unauthorized. Please log in again."));
        } else {
          const errorText = await response.text();
          throw new Error(
            `${str("Failed to delete license:")} ${response.status} ${response.statusText} - ${errorText}`,
          );
        }
      } else {
        setMessage(
          `${str("License")} ${filename} ${str("deleted successfully.")}`,
        );
        // Refetch the list of licenses after deletion
        fetchLicenses();
      }
    } catch (err) {
      setError(err.message);
      console.error("Error deleting license:", err);
    }
  };

  // Function to handle license generation form submission
  const handleGenerateLicense = async (event) => {
    event.preventDefault(); // Prevent default form submission

    setMessage(""); // Clear previous messages
    setError(null); // Clear previous errors

    let requestBody;
    if (generateType === "days") {
      requestBody = {
        email: userEmail,
        level: generateLicenseLevel,
        days: parseInt(days, 10), // Ensure days is an integer
      };
    } else {
      // generateType === 'date'
      const date = new Date(expiryDate);
      if (isNaN(date.getTime())) {
        setError(str("Invalid date format."));
        return;
      }
      requestBody = {
        email: userEmail,
        level: generateLicenseLevel,
        expiry_date: date.toISOString(), // Format as ISO 8601 string
      };
    }

    try {
      // Use the provided authFetch utility for POST request
      const response = await authFetch(`${API_BASE_URL}/license/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        if (response.status === 401) {
          setError(str("Unauthorized. Please log in again."));
        } else {
          const errorText = await response.text();
          throw new Error(
            `${str("Failed to generate license:")} ${response.status} ${response.statusText} - ${errorText}`,
          );
        }
      } else {
        const successMessage = await response.text(); // Or response.json() if backend returns JSON
        setMessage(
          `${str("License generated successfully:")} ${successMessage}`,
        );
        fetchLicenses();
      }
    } catch (err) {
      setError(err.message);
      console.error("Error generating license:", err);
    }
  };

  return (
    <div className="license-manager-container">
      {loading && (
        <p className="license-manager-loading">
          <Loader />
        </p>
      )}
      <ErrorMessage errorText={error} onClose={() => setError(null)} />
      <NotifyMessage text={message} />

      {/* Generate New License Form */}
      <div className="license-manager-form-container">
        <h3 className="license-manager-heading">
          <Trans>Generate New License</Trans>
        </h3>
        <form onSubmit={handleGenerateLicense} className="license-manager-form">
          <div className="license-manager-form-group">
            <label className="license-manager-label" htmlFor="userEmail">
              <Trans>User Email</Trans>
            </label>
            {/* Displaying user email, not editable in this form */}
            <input
              className="license-manager-input license-manager-input-disabled"
              id="userEmail"
              type="text"
              value={userEmail}
              disabled // User email is passed as a prop
            />
          </div>

          <Divider />

          {/* License Generation Type Selection */}
          <div className="license-manager-form-group">
            <label className="license-manager-label">
              <Trans>Expiration Setting</Trans>
            </label>
            <div className="license-manager-radio-group">
              <label className="license-manager-radio-label">
                <input
                  type="radio"
                  value="days"
                  checked={generateType === "days"}
                  onChange={() => setGenerateType("days")}
                  className="license-manager-radio-input"
                />
                <Trans>By Days</Trans>
              </label>
              <label className="license-manager-radio-label">
                <input
                  type="radio"
                  value="date"
                  checked={generateType === "date"}
                  onChange={() => setGenerateType("date")}
                  className="license-manager-radio-input"
                />
                <Trans>By Specific Date</Trans>
              </label>
            </div>
          </div>

          {/* Conditional Input based on Generation Type */}
          {generateType === "days" && (
            <div className="license-manager-form-group">
              <label className="license-manager-label" htmlFor="days">
                <Trans>Days from now</Trans>
              </label>
              <input
                className="license-manager-input"
                id="days"
                type="number"
                value={days}
                onChange={(e) => setDays(e.target.value)}
                required
                min="1"
              />
            </div>
          )}

          {generateType === "date" && (
            <div className="license-manager-form-group">
              <label className="license-manager-label" htmlFor="expiryDate">
                <Trans>Expiry Date (UTC)</Trans>
              </label>
              {/* Use type="datetime-local" or type="date" depending on desired granularity */}
              {/* Note: datetime-local input format might need conversion to ISO 8601 */}
              <input
                className="license-manager-input"
                id="expiryDate"
                type="datetime-local" // Or "date" if only date is needed
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                required
              />
              <p className="license-manager-help-text">
                <Trans>Enter date and time in UTC.</Trans>
              </p>
            </div>
          )}

          <Divider />

          <SelectionInput
            selectedValue={generateLicenseLevel}
            onChange={setGenerateLicenseLevel}
            values={["Basic"]}
            name={str("License level")}
          />

          <Divider />

          <div className="license-manager-form-actions">
            <Button type="submit" appearance="primary">
              <Trans>Generate License</Trans>
            </Button>
          </div>
        </form>
      </div>

      <Divider>
        <Trans>Licenses</Trans>
      </Divider>

      <div className="license-manager-licenses-section">
        {licenses.length === 0 && !loading && !error && (
          <p className="license-manager-no-licenses">
            <Trans>No licenses found</Trans>
          </p>
        )}
        <List bordered>
          {licenses.map((license, index) => (
            <List.Item
              key={index}
              className="license-item license-manager-license-item"
            >
              <LicenseVisualize
                filename={license.filename}
                expiration={license.data}
                level={license.data.level}
              />
              <div>
                <Button
                  appearance="link"
                  color="red"
                  onClick={() => handleDeleteLicense(license.filename)}
                >
                  <Trans>Delete license file</Trans>
                </Button>
              </div>
            </List.Item>
          ))}
        </List>
      </div>
    </div>
  );
};

export default LicenseManager;
