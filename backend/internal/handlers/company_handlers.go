package handlers

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"

	"carpaintr/data"
	"carpaintr/data/userdata"
	"carpaintr/internal/middleware"
	"carpaintr/internal/models"
)

func HandleGetCompanyInfo(w http.ResponseWriter, r *http.Request) {
	// Extract email from JWT (in a real app, you'd get this from context)
	contextUser := r.Context().Value("user")
	user, ok := contextUser.(models.User)

	if !ok {
		middleware.HandleError(w, fmt.Errorf("Wrong user context"), http.StatusInternalServerError)
	}

	userdataPath := filepath.Join(data.GetUserDataPath(), userdata.EmailToDirName(user.Email))
	companyFile := filepath.Join(userdataPath, "info", "company.json")

	// Check if file exists
	if _, err := os.Stat(companyFile); os.IsNotExist(err) {
		middleware.HandleError(w, fmt.Errorf("company info not found"), http.StatusBadRequest)
		return
	}

	// Open and read file
	file, err := os.Open(companyFile)
	if err != nil {
		middleware.HandleError(w, fmt.Errorf("failed to open company info file: %v", err), http.StatusInternalServerError)
		return
	}
	defer file.Close()

	// Set appropriate headers
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-cache")

	// Copy file directly to response writer
	if _, err := io.Copy(w, file); err != nil {
		// Note: At this point headers might have been sent, so we can't use HandleError
		fmt.Printf("Error writing response: %v\n", err)
	}
}
