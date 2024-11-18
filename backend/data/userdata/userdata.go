package userdata

import (
	"carpaintr/data"
	"fmt"
	"os"
	"path"
	"path/filepath"
	"strings"
	"unicode"
)

func EmailToDirName(email string) string {
	// Convert to lowercase
	email = strings.ToLower(email)

	// Replace special characters with distinctive patterns
	email = strings.ReplaceAll(email, "@", "--at--")
	email = strings.ReplaceAll(email, ".", "-dot-")

	// Replace other non-alphanumeric characters with hyphen
	var result strings.Builder
	prevWasHyphen := false

	for _, ch := range email {
		if unicode.IsLetter(ch) || unicode.IsNumber(ch) {
			result.WriteRune(ch)
			prevWasHyphen = false
		} else if !prevWasHyphen {
			result.WriteRune('-')
			prevWasHyphen = true
		}
	}

	// Trim hyphens from start and end
	return strings.Trim(result.String(), "-")
}

// CreateDirectoryStructureForUser creates a standard directory structure for a given user email.
// Returns the base directory path or an error if creation fails.
func CreateDirectoryStructureForUser(email string) (string, error) {
	dirname := path.Join(data.GetUserDataPath(), EmailToDirName(email))

	// Define the subdirectories to create
	subdirs := []string{"logs", "licenses", "override", "info"}

	// Create the base directory first
	if err := os.MkdirAll(dirname, 0755); err != nil {
		return "", fmt.Errorf("failed to create base directory: %w", err)
	}

	// Create each subdirectory
	for _, subdir := range subdirs {
		fullPath := filepath.Join(dirname, subdir)
		if err := os.MkdirAll(fullPath, 0755); err != nil {
			return "", fmt.Errorf("failed to create subdirectory %s: %w", subdir, err)
		}
	}

	// Return the absolute path to the base directory
	absPath, err := filepath.Abs(dirname)
	if err != nil {
		return dirname, fmt.Errorf("failed to get absolute path: %w", err)
	}

	return absPath, nil
}
