package auth

import (
	"time"

	"github.com/dgrijalva/jwt-go"
)

var jwtSecret = []byte("supersecretkey")

// Claims represents the JWT claims structure
type Claims struct {
	Email string `json:"email"`
	jwt.StandardClaims
}

// GenerateJWT creates a new JWT token for the given email
func GenerateJWT(email string) (string, error) {
	expirationTime := time.Now().Add(24 * time.Hour)
	claims := &Claims{
		Email: email,
		StandardClaims: jwt.StandardClaims{
			ExpiresAt: expirationTime.Unix(),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtSecret)
}

// ValidateJWT validates the given JWT token and returns claims
func ValidateJWT(tokenString string) (*Claims, error) {
	claims := &Claims{}

	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		return jwtSecret, nil
	})

	if err != nil || !token.Valid {
		return nil, err
	}

	return claims, nil
}
