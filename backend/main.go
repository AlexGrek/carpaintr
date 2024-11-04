package main

import (
	"bufio"
	"carpaintr/data"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/dgrijalva/jwt-go"
	"github.com/gorilla/mux"
	"golang.org/x/crypto/bcrypt"
)

var jwtSecret = []byte("supersecretkey")

type User struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

var users = make(map[string]string)    // In-memory user store (email -> hashed password)
var admins = make(map[string]struct{}) // For caching admin emails

func isAdmin(email string) bool {
	_, exists := admins[email]
	return exists
}

func loadAdmins(filename string) error {
	log.Println("Initializing admin users...")
	file, err := os.Open(filename)
	if err != nil {
		return err
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		email := scanner.Text()
		if email != "" {
			admins[email] = struct{}{} // Store email as a key in the map
		}
	}

	if err := scanner.Err(); err != nil {
		return err
	}
	return nil
}

// JWT Claims
type Claims struct {
	Email string `json:"email"`
	jwt.StandardClaims
}

type LicenseInfo struct {
	IsActive   bool   `json:"is_active"`
	EndsDate   string `json:"ends_date"` // Use string for simplicity, could be time.Time
	LicensedTo string `json:"licensed_to"`
	Level      string `json:"level"`
}

type CompanyInfo struct {
	Email       string      `json:"email"`
	License     LicenseInfo `json:"license"`
	CompanyName string      `json:"company_name"`
	CurrentTime string      `json:"current_time"`
}

// function to load initial users from a JSON file
func loadInitialUsers(filename string) error {
	log.Println("Reading initial users...")
	file, err := os.Open(filename)
	if err != nil {
		if os.IsNotExist(err) {
			// If the file doesn't exist, return nil (no initial users to load)
			return nil
		}
		return err // Return other errors
	}
	defer file.Close()

	byteValue, err := ioutil.ReadAll(file)
	if err != nil {
		return err
	}

	var initialUsers map[string]string // email -> password
	err = json.Unmarshal(byteValue, &initialUsers)
	if err != nil {
		return err
	}

	// Populate the users map with initial data
	for email, password := range initialUsers {
		if _, exists := users[email]; !exists {
			log.Println("email: " + email + "; passwd: " + password)
			hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
			if err == nil {
				users[email] = string(hashedPassword)
			}
		}
	}

	return nil
}

// In main function, call loadInitialUsers
func main() {
	err := loadInitialUsers("users_initial.json")
	if err != nil {
		log.Printf("Failed to load initial users: %v\n", err)
	}

	err = data.InitializeDataDirectoryStructure()
	if err != nil {
		log.Fatalf("Failed to load initial users: %v\n", err)
	}

	// Load admin emails from admins.txt
	err = loadAdmins("admins.txt")
	if err != nil {
		log.Printf("Failed to load admins: %v\n", err)
	}

	// Serve static React app from /frontend
	fs := http.FileServer(http.Dir("./frontend"))
	http.Handle("/", fs)

	r := mux.NewRouter()

	// API routes
	r.HandleFunc("/api/v1/admin/register", handleAdminRegister)
	r.HandleFunc("/api/v1/login", handleLogin)
	r.HandleFunc("/api/v1/get", handleGet)
	r.HandleFunc("/api/v1/season", handleSeason)
	r.HandleFunc("/api/v1/getcompanyinfo", handleGetCompanyInfo)
	r.HandleFunc("/api/v1/admin/status", handleAdminStatus)
	r.HandleFunc("/api/v1/admin/updatecompanyinfo", handleAdminUpdateCompanyInfo)
	r.HandleFunc("/api/v1/carmakes", carMakesHandler).Methods("GET")
	r.HandleFunc("/api/v1/carmodels/{make}", carModelsHandler).Methods("GET")

	log.Println("Server started at http://localhost:8080")
	log.Fatal(http.ListenAndServe(":8080", r))
}

// Handler for /api/v1/carmakes - returns the list of car vendors
func carMakesHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	data, err := data.ListCarBrands(data.CreateEnvPathConfig())
	if err != nil {
		http.Error(w, "Error reading car brands", http.StatusInternalServerError)
		log.Fatal(err)
	}
	json.NewEncoder(w).Encode(data)
}

// Handler for /api/v1/carmodels/{make} - returns models for a specified make
func carModelsHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	make := vars["make"]

	models, err := data.ReadCarYamlFile(make, data.CreateEnvPathConfig())
	if err != nil {
		http.Error(w, "Error reading cars of the brand", http.StatusInternalServerError)
		log.Fatal(err)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(models)
}

func handleAdminUpdateCompanyInfo(w http.ResponseWriter, r *http.Request) {
	tokenString := r.Header.Get("Authorization")
	if tokenString == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	email, err := validateJWT(tokenString)
	if err != nil || !isAdmin(email) {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Parse the request body for CompanyInfo details
	var companyInfo CompanyInfo
	err = json.NewDecoder(r.Body).Decode(&companyInfo)
	if err != nil {
		http.Error(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	// Log the received company info
	log.Printf("Received Company Info: %+v\n", companyInfo)

	// Respond with success (even though it does nothing)
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Company info updated (dummy action)"})
}

func handleAdminRegister(w http.ResponseWriter, r *http.Request) {
	tokenString := r.Header.Get("Authorization")
	if tokenString == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	email, err := validateJWT(tokenString)
	if err != nil || !isAdmin(email) {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Parse the request body for new user details
	var newUser struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	err = json.NewDecoder(r.Body).Decode(&newUser)
	if err != nil {
		http.Error(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	// Check if the user already exists
	if _, exists := users[newUser.Email]; exists {
		http.Error(w, "User already exists", http.StatusConflict)
		return
	}

	// Hash the password and store the new user
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(newUser.Password), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, "Failed to register user", http.StatusInternalServerError)
		return
	}

	users[newUser.Email] = string(hashedPassword)

	// Respond with success
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"message": "User created successfully"})
}

func handleRegister(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var user User
	err := json.NewDecoder(r.Body).Decode(&user)
	if err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	if _, exists := users[user.Email]; exists {
		http.Error(w, "User already exists", http.StatusConflict)
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(user.Password), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, "Error hashing password", http.StatusInternalServerError)
		return
	}

	users[user.Email] = string(hashedPassword)
	w.WriteHeader(http.StatusCreated)
	fmt.Fprintf(w, "User %s registered successfully", user.Email)
}

func handleAdminStatus(w http.ResponseWriter, r *http.Request) {
	tokenString := r.Header.Get("Authorization")
	if tokenString == "" {
		http.NotFound(w, r)
		return
	}

	email, err := validateJWT(tokenString)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	// Check if user is admin
	if !isAdmin(email) {
		http.NotFound(w, r)
		return
	}

	// Create dummy response for admin
	response := map[string]string{
		"status":  "success",
		"message": "You have admin access.",
		"data":    "Dummy admin data",
	}

	// Set the response header to application/json
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func handleLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var user User
	err := json.NewDecoder(r.Body).Decode(&user)
	if err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		log.Default().Println("Invalid request")
		return
	}

	storedPassword, exists := users[user.Email]
	if !exists {
		http.Error(w, "Invalid email or password", http.StatusUnauthorized)
		return
	}

	err = bcrypt.CompareHashAndPassword([]byte(storedPassword), []byte(user.Password))
	if err != nil {
		http.Error(w, "Invalid email or password", http.StatusUnauthorized)
		return
	}

	token, err := generateJWT(user.Email)
	if err != nil {
		http.Error(w, "Error generating token", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{"token": token})
}

func handleGetCompanyInfo(w http.ResponseWriter, r *http.Request) {
	tokenString := r.Header.Get("Authorization")
	if tokenString == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	email, err := validateJWT(tokenString)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Create dummy company info
	companyInfo := CompanyInfo{
		Email: email,
		License: LicenseInfo{
			IsActive:   true,
			EndsDate:   "2025-12-31",
			LicensedTo: "Example Corp",
			Level:      "Gold",
		},
		CompanyName: "Example Company",
		CurrentTime: time.Now().Format(time.RFC3339),
	}

	// Set the response header to application/json
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(companyInfo)
}

func handleGet(w http.ResponseWriter, r *http.Request) {
	tokenString := r.Header.Get("Authorization")
	if tokenString == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	email, err := validateJWT(tokenString)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	fmt.Fprintf(w, "Hello, %s", email)
}

func handleSeason(w http.ResponseWriter, r *http.Request) {
	tokenString := r.Header.Get("Authorization")
	if tokenString == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	_, err := validateJWT(tokenString)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	season, seasonData, err := data.GetCurrentSeason(data.CreateEnvPathConfig())
	if err != nil {
		http.Error(w, "Error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	data := map[string]interface{}{
		"season":  season,
		"details": seasonData,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}

// JWT Token generation
func generateJWT(email string) (string, error) {
	expirationTime := time.Now().Add(24 * time.Hour)
	claims := &Claims{
		Email: email,
		StandardClaims: jwt.StandardClaims{
			ExpiresAt: expirationTime.Unix(),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString(jwtSecret)
	if err != nil {
		return "", err
	}

	return tokenString, nil
}

// JWT Token validation
func validateJWT(tokenString string) (string, error) {
	claims := &Claims{}

	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		return jwtSecret, nil
	})

	if err != nil || !token.Valid {
		return "", err
	}

	return claims.Email, nil
}
