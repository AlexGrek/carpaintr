package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"carpaintr/data"
	"carpaintr/data/userdata"
	"carpaintr/internal/auth"
	"carpaintr/internal/middleware"
	"carpaintr/internal/models"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type AdminHandlers struct {
	UserService *auth.UserService
}

type AdminManagementRequest struct {
	Action string      `json:"action"`
	Email  string      `json:"email"`
	Data   interface{} `json:"data,omitempty"`
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

func (h *AdminHandlers) HandleListUsers(w http.ResponseWriter, r *http.Request) {
	users, err := h.UserService.ListUsers()
	if err != nil {
		middleware.HandleError(w, err, http.StatusInternalServerError)
		return
	}
	middleware.RespondJSON(w, http.StatusOK, users)
}

func (h *AdminHandlers) HandleAdminUpdateCompanyInfo(w http.ResponseWriter, r *http.Request) {
	var companyInfo models.CompanyInfo
	if err := json.NewDecoder(r.Body).Decode(&companyInfo); err != nil {
		middleware.HandleError(w, err, http.StatusBadRequest)
		return
	}

	userdataPath := filepath.Join(data.GetUserDataPath(), userdata.EmailToDirName(companyInfo.Email))

	// Update company info file

	companyJSON, err := json.MarshalIndent(companyInfo, "", "  ")
	if err != nil {
		middleware.HandleError(w, fmt.Errorf("failed to marshal company info: %v", err), http.StatusInternalServerError)
		return
	}
	companyFile := filepath.Join(userdataPath, "info", "company.json")
	if err := os.WriteFile(companyFile, companyJSON, 0644); err != nil {
		middleware.HandleError(w, fmt.Errorf("failed to write company file: %v", err), http.StatusInternalServerError)
		return
	}

	// Create log entry
	timestamp := time.Now().Format("2006-01-02 15:04:05")
	logEntry := fmt.Sprintf("[%s] Updated company info for: %s\n", timestamp, companyInfo.CompanyName)
	logFile := filepath.Join(userdataPath, "logs", "infoupdate.log")
	f, err := os.OpenFile(logFile, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		middleware.HandleError(w, fmt.Errorf("failed to open log file: %v", err), http.StatusInternalServerError)
		return
	}
	defer f.Close()

	if _, err := f.WriteString(logEntry); err != nil {
		middleware.HandleError(w, fmt.Errorf("failed to write log entry: %v", err), http.StatusInternalServerError)
		return
	}

	// Handle license info if present
	if companyInfo.License != nil && !isEmptyLicense(companyInfo.License) {
		licenseTimestamp := time.Now().Format("20060102150405")
		licenseFile := filepath.Join(userdataPath, "licenses", fmt.Sprintf("%s.json", licenseTimestamp))
		licenseJSON, err := json.MarshalIndent(companyInfo.License, "", "  ")
		if err != nil {
			middleware.HandleError(w, fmt.Errorf("failed to marshal license info: %v", err), http.StatusInternalServerError)
			return
		}
		if err := os.WriteFile(licenseFile, licenseJSON, 0644); err != nil {
			middleware.HandleError(w, fmt.Errorf("failed to write license file: %v", err), http.StatusInternalServerError)
			return
		}
	}

	middleware.RespondJSON(w, http.StatusOK, map[string]string{
		"message": "Company info update processed successfully",
	})
}

// isEmptyLicense checks if the license info is effectively empty
func isEmptyLicense(license *models.LicenseInfo) bool {
	return license.LicensedTo == "" &&
		license.Level == "" &&
		license.EndsDate == "" &&
		!license.IsActive
}

func (h *AdminHandlers) HandleManagementRequest(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req AdminManagementRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		middleware.HandleError(w, fmt.Errorf("invalid request format: %v", err), http.StatusBadRequest)
		return
	}

	// Validate basic fields
	if req.Email == "" {
		middleware.HandleError(w, fmt.Errorf("email is required"), http.StatusBadRequest)
		return
	}

	// Process different actions
	switch req.Action {
	case "delete":
		err := h.deleteUser(req.Email)
		if err != nil {
			middleware.HandleError(w, err, http.StatusInternalServerError)
			return
		}
		middleware.RespondJSON(w, http.StatusOK, map[string]string{
			"message": fmt.Sprintf("User %s deleted successfully", req.Email),
		})

	case "change_pass":
		password, ok := req.Data.(string)
		if !ok {
			middleware.HandleError(w, fmt.Errorf("invalid password format"), http.StatusBadRequest)
			return
		}
		err := h.changeUserPassword(req.Email, password)
		if err != nil {
			middleware.HandleError(w, err, http.StatusInternalServerError)
			return
		}
		middleware.RespondJSON(w, http.StatusOK, map[string]string{
			"message": fmt.Sprintf("Password changed successfully for user %s", req.Email),
		})

	default:
		middleware.HandleError(w, fmt.Errorf("unknown action: %s", req.Action), http.StatusBadRequest)
	}
}

// deleteUser handles user deletion
func (h *AdminHandlers) deleteUser(email string) error {
	// First check if user exists
	var user auth.User
	result := h.UserService.DB.Where("email = ?", email).First(&user)
	if result.Error != nil {
		if result.Error == gorm.ErrRecordNotFound {
			return fmt.Errorf("user not found")
		}
		return fmt.Errorf("error finding user: %v", result.Error)
	}

	// Delete user from database
	result = h.UserService.DB.Delete(&user)
	if result.Error != nil {
		return fmt.Errorf("error deleting user: %v", result.Error)
	}

	// Optionally, you could also delete user's data directory
	// This depends on whether you want to keep user data after account deletion
	// userDataPath := filepath.Join(data.GetUserDataPath(), userdata.EmailToDirName(email))
	// os.RemoveAll(userDataPath) // Be careful with this!

	return nil
}

// changeUserPassword handles password change for a specific user
func (h *AdminHandlers) changeUserPassword(email, newPassword string) error {
	// First check if user exists
	var user auth.User
	result := h.UserService.DB.Where("email = ?", email).First(&user)
	if result.Error != nil {
		if result.Error == gorm.ErrRecordNotFound {
			return fmt.Errorf("user not found")
		}
		return fmt.Errorf("error finding user: %v", result.Error)
	}

	// Hash the new password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("error hashing password: %v", err)
	}

	// Update the password
	result = h.UserService.DB.Model(&user).Update("password", string(hashedPassword))
	if result.Error != nil {
		return fmt.Errorf("error updating password: %v", result.Error)
	}

	return nil
}
