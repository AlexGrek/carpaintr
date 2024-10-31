package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"

	"github.com/AlexGrek/darkreader/src/utils"
)

const ACCESS_READER = "reader"
const ACCESS_CONTRIBUTOR = "contributor"
const ACCESS_MASTER = "master"

// Password represents a master password
type Password struct {
	ID       int    `json:"id"`
	Level    string `json:"level"`
	Password string `json:"password"`
}

func getPasswdFilePath() string {
	filePath := os.Getenv("MASTER_PASSWORDS_FILE")
	if filePath == "" {
		filePath = "master_passwords.json"
	}
	return filePath
}

func InitPasswd() {
	filePath := getPasswdFilePath()
	// Check if the JSON file exists
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		// If the file does not exist, generate random passwords and dump them into the file
		fmt.Println("Generating passwords...")
		passwords := generatePasswords(10) // Generate 10 random passwords
		err_save := savePasswordsToFile(filePath, passwords)
		if err_save != nil {
			log.Fatalln(err_save)
		}
		fmt.Println("Passwords generated and saved to", filePath)
	} else {
		// If the file exists, read the passwords from the file
		passwords, err := readPasswordsFromFile(filePath)
		if err != nil {
			fmt.Println("Error reading passwords:", err)
			return
		}

		// Print the read passwords
		fmt.Println("Read passwords from file:")
		for _, password := range passwords {
			fmt.Println(password)
		}
	}
}

func generatePasswords(count int) []Password {
	var passwords []Password
	for i := 1; i <= count; i++ {
		password := Password{
			ID:       i,
			Level:    "reader",
			Password: utils.GenerateNumericPassword(4),
		}
		passwords = append(passwords, password)
	}
	for i := 1; i <= count; i++ {
		password := Password{
			ID:       i + len(passwords),
			Level:    "contributor",
			Password: utils.GenerateRandomPassword(6),
		}
		passwords = append(passwords, password)
	}
	masterPassword := Password{
		ID:       100000,
		Level:    "master",
		Password: utils.GenerateRandomPassword(12),
	}
	passwords = append(passwords, masterPassword)
	// Print the read passwords
	fmt.Println("Just generated passwords:")
	for _, password := range passwords {
		fmt.Println(password)
	}
	return passwords
}

// savePasswordsToFile saves passwords to a JSON file
func savePasswordsToFile(filePath string, passwords []Password) error {
	data, err := json.MarshalIndent(passwords, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filePath, data, 0644)
}

// readPasswordsFromFile reads passwords from a JSON file
func readPasswordsFromFile(filePath string) ([]Password, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, err
	}
	var passwords []Password
	if err := json.Unmarshal(data, &passwords); err != nil {
		return nil, err
	}
	return passwords, nil
}

func GetAuthLevelForPasswd(pass string) (string, error) {
	passwords, err := readPasswordsFromFile(getPasswdFilePath())
	if err != nil {
		return "", err
	}
	for _, password := range passwords {
		if password.Password == pass {
			return password.Level, nil
		}
	}
	return "", nil // Password not found
}

func AuthLevelAsNumeric(level string) int {
	if level == ACCESS_READER {
		return 1
	}
	if level == ACCESS_CONTRIBUTOR {
		return 10
	}
	if level == ACCESS_MASTER {
		return 1000
	}
	return -1
}
