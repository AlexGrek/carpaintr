package session

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"time"

	"github.com/AlexGrek/darkreader/src/utils"
)

type SessionData struct {
	Secret    string    `json:"secret"`
	CreatedAt time.Time `json:"created_at"`
	Level     string    `json:"level"`
	Password  string    `json:"passwd"`
}

func CreateSession(passwd string, level string) (string, error) {
	sessionFile := os.Getenv("SESSION_FILE")
	if sessionFile == "" {
		sessionFile = "sessions.json"
	}

	// Check if the file exists
	_, err := os.Stat(sessionFile)
	if os.IsNotExist(err) {
		// Create the file if it doesn't exist
		file, err := os.Create(sessionFile)
		if err != nil {
			return "", err
		}
		file.Close()
	}

	// Read the existing data from the file
	data, err := os.ReadFile(sessionFile)
	if err != nil {
		return "", err
	}

	// Unmarshal the existing data into a slice of SessionData
	var sessions []SessionData
	if len(data) > 0 {
		err = json.Unmarshal(data, &sessions)
		if err != nil {
			return "", err
		}
	}

	secret := utils.GenerateRandomPassword(16)

	// Create a new SessionData and append it to the slice
	newSession := SessionData{
		Secret:    secret, // You'll need to implement this function
		CreatedAt: time.Now(),
		Level:     level,
		Password:  passwd,
	}
	sessions = append(sessions, newSession)

	// Marshal the updated slice of sessions and write it to the file
	updatedData, err := json.Marshal(sessions)
	if err != nil {
		return "", err
	}
	err = os.WriteFile(sessionFile, updatedData, 0644)
	if err != nil {
		return "", err
	}

	fmt.Printf("Session '%s' created with level '%s' at %s\n", newSession.Secret, newSession.Level, newSession.CreatedAt.Format("2006-01-02 15:04:05"))

	return secret, nil
}

func GetSessionBySecret(secret string) (*SessionData, error) {
    sessionFile := os.Getenv("SESSION_FILE")
    if sessionFile == "" {
        sessionFile = "sessions.json"
    }

    data, err := os.ReadFile(sessionFile)
    if err != nil {
        return nil, err
    }

    var sessions []SessionData
    err = json.Unmarshal(data, &sessions)
    if err != nil {
        return nil, err
    }

    for _, session := range sessions {
        if session.Secret == secret {
            return &session, nil
        }
    }

    return nil, errors.New("session not found")
}

func DeleteSessionBySecret(secret string) error {
    sessionFile := os.Getenv("SESSION_FILE")
    if sessionFile == "" {
        sessionFile = "sessions.json"
    }

    data, err := os.ReadFile(sessionFile)
    if err != nil {
        return err
    }

    var sessions []SessionData
    err = json.Unmarshal(data, &sessions)
    if err != nil {
        return err
    }

    for i, session := range sessions {
        if session.Secret == secret {
            sessions = append(sessions[:i], sessions[i+1:]...)
            updatedData, err := json.Marshal(sessions)
            if err != nil {
                return err
            }
            err = os.WriteFile(sessionFile, updatedData, 0644)
            if err != nil {
                return err
            }
            return nil
        }
    }

    return errors.New("session not found")
}
