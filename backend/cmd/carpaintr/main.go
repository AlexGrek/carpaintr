package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"

	"carpaintr/data"
	"carpaintr/internal/auth"
	"carpaintr/internal/handlers"
	"carpaintr/internal/middleware"

	"github.com/gorilla/mux"
)

func populateInitialUsers(userService *auth.UserService, filename string) error {
	// Open and read the initial users JSON file
	file, err := os.Open(filename)
	if err != nil {
		return err
	}
	defer file.Close()

	var initialUsers map[string]string
	decoder := json.NewDecoder(file)
	if err := decoder.Decode(&initialUsers); err != nil {
		return err
	}

	// Load initial users into the database
	return userService.LoadInitialUsers(initialUsers)
}

func main() {
	// Initialize data directories
	if err := data.InitializeDataDirectoryStructure(); err != nil {
		log.Fatalf("Failed to initialize data directory: %v", err)
	}

	// Initialize SQLite database and UserService
	userService, err := auth.NewUserService("users.db")
	if err != nil {
		log.Fatalf("Failed to create user service: %v", err)
	}

	// Populate initial users from JSON
	if err := populateInitialUsers(userService, "users_initial.json"); err != nil {
		log.Printf("Failed to load initial users: %v", err)
	}

	// Create user handlers with the new UserService
	userHandlers := handlers.NewUserHandlers(userService)

	adminHandlers := handlers.NewAdminHandlers(userService)

	// auth checks for protected routes
	m := middleware.NewAuthMiddleware(userService)
	ac, err := middleware.NewAdminChecker("admins.txt")
	if err != nil {
		log.Fatal(err)
	}
	admin := m.AdminMiddleware(ac)

	// Serve static React frontend
	fs := http.FileServer(http.Dir("./frontend"))
	http.Handle("/", fs)

	// Create router
	r := mux.NewRouter()

	// Configure API routes
	r.HandleFunc("/api/v1/admin/register", admin(adminHandlers.HandleAdminRegister))
	r.HandleFunc("/api/v1/login", userHandlers.HandleLogin)
	r.HandleFunc("/api/v1/get", m.Middleware(handlers.HandleGet))
	r.HandleFunc("/api/v1/season", m.Middleware(handlers.HandleSeason))
	r.HandleFunc("/api/v1/basecolors", m.Middleware(handlers.HandleBaseColors))
	r.HandleFunc("/api/v1/getcompanyinfo", m.Middleware(handlers.HandleGetCompanyInfo))
	r.HandleFunc("/api/v1/changepassword", m.Middleware(userHandlers.HandleChangePassword))
	r.HandleFunc("/api/v1/getlicenses", m.Middleware(handlers.HandleGetAllLicensesInfo))
	r.HandleFunc("/api/v1/haveactivelicense", m.Middleware(handlers.HandleHasActiveLicense))

	r.HandleFunc("/api/v1/admin/status", admin(adminHandlers.HandleAdminStatus))
	r.HandleFunc("/api/v1/admin/listusers", admin(adminHandlers.HandleListUsers))
	r.HandleFunc("/api/v1/admin/manageuser", admin(adminHandlers.HandleManagementRequest))
	r.HandleFunc("/api/v1/admin/updatecompanyinfo", admin(adminHandlers.HandleAdminUpdateCompanyInfo))
	r.HandleFunc("/api/v1/carmakes", m.Middleware(handlers.CarMakesHandler)).Methods("GET")
	r.HandleFunc("/api/v1/carmodels/{make}", m.Middleware(handlers.CarModelsHandler)).Methods("GET")

	// Start server
	log.Println("Server started at http://localhost:8080")
	log.Fatal(http.ListenAndServe(":8080", r))
}
