package handlers

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"carpaintr/data"
	"carpaintr/data/userdata"
	"carpaintr/internal/middleware"
	"carpaintr/internal/models"
)

func getLicensesForUser(userEmail string) (map[string]models.License, error) {
	userdataPath := filepath.Join(data.GetUserDataPath(), userdata.EmailToDirName(userEmail))
	companyLicenses := filepath.Join(userdataPath, "licenses")
	// Initialize result map
	licenses := make(map[string]models.License)

	// Read all files in directory
	files, err := ioutil.ReadDir(companyLicenses)
	if err != nil {
		return nil, err
	}

	// Process each file
	for _, file := range files {
		// Skip directories
		if file.IsDir() {
			continue
		}

		// Read file content
		filePath := filepath.Join(companyLicenses, file.Name())
		content, err := ioutil.ReadFile(filePath)
		if err != nil {
			return nil, err
		}

		// Parse JSON content
		var license models.License
		if err := json.Unmarshal(content, &license); err != nil {
			return nil, err
		}

		// Add to map using filename (without extension) as key
		key := strings.TrimSuffix(file.Name(), filepath.Ext(file.Name()))
		licenses[key] = license
	}

	return licenses, nil
}

func DoesUserHaveActiveLicense(userEmail string) (bool, error) {
	licenses, err := getLicensesForUser(userEmail)
	if err != nil {
		return false, err
	}

	now := time.Now()
	for _, license := range licenses {
		if license.Expire.After(now) {
			return true, nil
		}
	}

	return false, nil
}

func DaysSinceLongestLicenseExpires(userEmail string) (int, error) {
	licenses, err := getLicensesForUser(userEmail)
	if err != nil {
		return 0, err
	}

	if len(licenses) == 0 {
		return 0, nil
	}

	now := time.Now()
	maxExpire := time.Time{} // Zero value to track the farthest expiration date

	for _, license := range licenses {
		if license.Expire.After(maxExpire) {
			maxExpire = license.Expire
		}
	}

	if maxExpire.After(now) {
		return 0, nil
	}

	daysSinceExpiration := int(now.Sub(maxExpire).Hours() / 24)
	return daysSinceExpiration, nil
}

func HandleGetAllLicensesInfo(w http.ResponseWriter, r *http.Request) {
	// Extract email from JWT (in a real app, you'd get this from context)
	contextUser := r.Context().Value("user")
	user, ok := contextUser.(models.User)

	if !ok {
		middleware.HandleError(w, fmt.Errorf("Wrong user context"), http.StatusInternalServerError)
	}

	licenses, err := getLicensesForUser(user.Email)

	if err != nil {
		middleware.HandleError(w, fmt.Errorf("failed to open company info file: %v", err), http.StatusInternalServerError)
		return
	}

	// Set appropriate headers
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-cache")

	// Copy file directly to response writer
	middleware.RespondJSON(w, http.StatusOK, licenses)
}

func HandleHasActiveLicense(w http.ResponseWriter, r *http.Request) {
	// Extract email from JWT (in a real app, you'd get this from context)
	contextUser := r.Context().Value("user")
	user, ok := contextUser.(models.User)

	if !ok {
		middleware.HandleError(w, fmt.Errorf("Wrong user context"), http.StatusInternalServerError)
	}

	doesHave, err := DoesUserHaveActiveLicense(user.Email)

	if err != nil {
		middleware.HandleError(w, fmt.Errorf("failed to open company info file: %v", err), http.StatusInternalServerError)
		return
	}

	// Set appropriate headers
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-cache")

	// Copy file directly to response writer
	middleware.RespondJSON(w, http.StatusOK, doesHave)
}
