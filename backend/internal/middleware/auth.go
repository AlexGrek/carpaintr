package middleware

import (
	"bufio"
	"context"
	"encoding/json"
	"net/http"
	"os"
	"strings"
	"sync"

	"carpaintr/internal/auth"
	"carpaintr/internal/models"
)

type AuthMiddleware struct {
	UserService *auth.UserService
}

type AdminChecker struct {
	adminList map[string]bool
	mutex     sync.RWMutex
}

// NewAdminChecker creates and initializes an AdminChecker
func NewAdminChecker(adminFilePath string) (*AdminChecker, error) {
	checker := &AdminChecker{
		adminList: make(map[string]bool),
	}

	// Load admin list from file
	err := checker.loadAdminList(adminFilePath)
	if err != nil {
		return nil, err
	}

	return checker, nil
}

// loadAdminList reads the admins.txt file and populates the admin list
func (ac *AdminChecker) loadAdminList(filePath string) error {
	file, err := os.Open(filePath)
	if err != nil {
		return err
	}
	defer file.Close()

	ac.mutex.Lock()
	defer ac.mutex.Unlock()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		email := strings.TrimSpace(scanner.Text())
		if email != "" {
			ac.adminList[email] = true
		}
	}

	return scanner.Err()
}

// isAdmin checks if a given email is in the admin list
func (ac *AdminChecker) isAdmin(email string) bool {
	ac.mutex.RLock()
	defer ac.mutex.RUnlock()
	return ac.adminList[email]
}

func NewAuthMiddleware(userService *auth.UserService) *AuthMiddleware {
	return &AuthMiddleware{UserService: userService}
}

// Middleware handles JWT token validation and user verification for protected routes
func (m *AuthMiddleware) Middleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Get token from header
		tokenString := r.Header.Get("Authorization")
		if tokenString == "" {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		// Validate JWT token
		claims, err := auth.ValidateJWT(tokenString)
		if err != nil {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		// Extract email from claims
		email := claims.Email

		// Verify user exists in database
		var user models.User
		result := m.UserService.DB.Where("email = ?", email).First(&user)
		if result.Error != nil {
			http.Error(w, "User not found", http.StatusUnauthorized)
			return
		}

		// Store user information in context for later use
		ctx := r.Context()
		ctx = context.WithValue(ctx, "user", user)

		// Call next handler with updated context
		next.ServeHTTP(w, r.WithContext(ctx))
	}
}

// AdminMiddleware extends AuthMiddleware to check for admin privileges
func (m *AuthMiddleware) AdminMiddleware(adminChecker *AdminChecker) func(http.HandlerFunc) http.HandlerFunc {
	return func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			// First run the regular auth middleware
			authHandler := m.Middleware(func(w http.ResponseWriter, r *http.Request) {
				// Get user from context (set by AuthMiddleware)
				user, ok := r.Context().Value("user").(models.User)
				if !ok {
					http.Error(w, "User context not found", http.StatusInternalServerError)
					return
				}

				// Check if user is an admin
				if !adminChecker.isAdmin(user.Email) {
					http.Error(w, "Forbidden: Admin access required", http.StatusForbidden)
					return
				}

				// User is authenticated and is an admin, proceed to the next handler
				next.ServeHTTP(w, r)
			})

			// Execute the combined middleware chain
			authHandler.ServeHTTP(w, r)
		}
	}
}

// RespondJSON is a utility function to send JSON responses
func RespondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

// HandleError standardizes error responses
func HandleError(w http.ResponseWriter, err error, status int) {
	http.Error(w, err.Error(), status)
}
