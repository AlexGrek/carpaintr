package handlers

import (
	"encoding/json"
	"net/http"

	"carpaintr/internal/auth"
	"carpaintr/internal/middleware"
	"carpaintr/internal/models"
)

type AdminHandlers struct {
	UserService *auth.UserService
}

func NewAdminHandlers(userService *auth.UserService) *AdminHandlers {
	return &AdminHandlers{UserService: userService}
}

func (h *AdminHandlers) HandleAdminRegister(w http.ResponseWriter, r *http.Request) {
	var newUser models.User
	if err := json.NewDecoder(r.Body).Decode(&newUser); err != nil {
		middleware.HandleError(w, err, http.StatusBadRequest)
		return
	}

	if err := h.UserService.RegisterUser(newUser.Email, newUser.Password); err != nil {
		middleware.HandleError(w, err, http.StatusConflict)
		return
	}

	middleware.RespondJSON(w, http.StatusCreated, map[string]string{
		"message": "Admin user created successfully",
	})
}

func (h *AdminHandlers) HandleAdminStatus(w http.ResponseWriter, r *http.Request) {
	response := map[string]string{
		"status":  "success",
		"message": "Admin access granted",
		"data":    "Dummy admin data",
	}

	middleware.RespondJSON(w, http.StatusOK, response)
}

func (h *AdminHandlers) HandleAdminUpdateCompanyInfo(w http.ResponseWriter, r *http.Request) {
	var companyInfo models.CompanyInfo
	if err := json.NewDecoder(r.Body).Decode(&companyInfo); err != nil {
		middleware.HandleError(w, err, http.StatusBadRequest)
		return
	}

	// Placeholder for actual update logic
	middleware.RespondJSON(w, http.StatusOK, map[string]string{
		"message": "Company info update processed",
	})
}
