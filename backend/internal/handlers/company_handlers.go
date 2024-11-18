package handlers

import (
	"net/http"
	"time"

	"carpaintr/internal/middleware"
	"carpaintr/internal/models"
)

func HandleGetCompanyInfo(w http.ResponseWriter, r *http.Request) {
	// Extract email from JWT (in a real app, you'd get this from context)
	email := "example@company.com"

	companyInfo := models.CompanyInfo{
		Email: email,
		License: models.LicenseInfo{
			IsActive:   true,
			EndsDate:   "2025-12-31",
			LicensedTo: "Example Corp",
			Level:      "Gold",
		},
		CompanyName: "Example Company",
		CurrentTime: time.Now().Format(time.RFC3339),
	}

	middleware.RespondJSON(w, http.StatusOK, companyInfo)
}
