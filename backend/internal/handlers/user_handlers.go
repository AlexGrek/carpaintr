package handlers

import (
	"encoding/json"
	"net/http"

	"carpaintr/internal/auth"
	"carpaintr/internal/middleware"
	"carpaintr/internal/models"
)

type UserHandlers struct {
	UserService *auth.UserService
}

func NewUserHandlers(userService *auth.UserService) *UserHandlers {
	return &UserHandlers{UserService: userService}
}

func (h *UserHandlers) HandleLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var user models.User
	if err := json.NewDecoder(r.Body).Decode(&user); err != nil {
		middleware.HandleError(w, err, http.StatusBadRequest)
		return
	}

	if !h.UserService.AuthenticateUser(user.Email, user.Password) {
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	token, err := auth.GenerateJWT(user.Email)
	if err != nil {
		middleware.HandleError(w, err, http.StatusInternalServerError)
		return
	}

	middleware.RespondJSON(w, http.StatusOK, map[string]string{"token": token})
}

func (h *UserHandlers) HandleRegister(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var user models.User
	if err := json.NewDecoder(r.Body).Decode(&user); err != nil {
		middleware.HandleError(w, err, http.StatusBadRequest)
		return
	}

	if err := h.UserService.RegisterUser(user.Email, user.Password); err != nil {
		middleware.HandleError(w, err, http.StatusConflict)
		return
	}

	middleware.RespondJSON(w, http.StatusCreated, map[string]string{
		"message": "User registered successfully",
	})
}
