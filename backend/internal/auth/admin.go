package auth

import (
	"bufio"
	"log"
	"os"
)

// Admins is a set of admin email addresses
var Admins = make(map[string]struct{})

// IsAdmin checks if an email is an admin
func IsAdmin(email string) bool {
	_, exists := Admins[email]
	return exists
}

// LoadAdmins reads admin emails from a text file
func LoadAdmins(filename string) error {
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
			Admins[email] = struct{}{}
		}
	}

	return scanner.Err()
}
