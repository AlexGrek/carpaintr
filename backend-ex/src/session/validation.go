package session

// Check if session exists and level is correct
func ValidateAccess(secret string, level string) (bool, error) {
	session, err := GetSessionBySecret(secret)
	if err != nil {
		return false, err
	}
	return session.Level == level, nil
	// TODO: add expiration checks
}
