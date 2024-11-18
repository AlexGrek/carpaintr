package models

// User represents a user in the system
type User struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}
