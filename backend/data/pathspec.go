package data

import (
	"fmt"
	"os"
	"path/filepath"
)

// getUserDataPath returns the value of the "CPNTR_USER_DATA_PATH" environment variable,
// or a default path if the variable is not set.
func GetUserDataPath() string {
	if path := os.Getenv("CPNTR_USER_DATA_PATH"); path != "" {
		return path
	}
	return "../userdata/" // Replace with your desired default
}

// getOriginDataPath returns the value of the "CPNTR_ORIGIN_DATA_PATH" environment variable,
// or a default path if the variable is not set.
func GetOriginDataPath() string {
	if path := os.Getenv("CPNTR_ORIGIN_DATA_PATH"); path != "" {
		return path
	}
	return "../data" // Replace with your desired default
}

func InitializeDataDirectoryStructure() error {
	datapathUser := GetUserDataPath()
	datapathOrigin := GetOriginDataPath()
	fmt.Println("Initializing data path:")
	fmt.Println(datapathUser)
	fmt.Println(datapathOrigin)
	err := createDirectoryStructure(datapathUser)
	if err != nil {
		return err
	}
	err = createDirectoryStructure(datapathOrigin)
	return err
}

func createDirectoryStructure(path string) error {
	// Use filepath.Split to separate the path into directory components
	dir, _ := filepath.Split(path)

	// Create the directory structure if it doesn't exist
	return os.MkdirAll(dir, 0755)
}
