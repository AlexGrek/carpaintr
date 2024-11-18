package auth

import (
	"carpaintr/data/userdata"
	"fmt"

	"github.com/glebarez/sqlite"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// User represents a user in the system
type User struct {
	gorm.Model
	Email    string `gorm:"unique;not null"`
	Password string `gorm:"not null"`
}

type UserService struct {
	DB *gorm.DB
}

// NewUserService creates a new UserService with database connection
func NewUserService(dbPath string) (*UserService, error) {
	dbURL := fmt.Sprintf("file:%s?cache=shared&mode=rwc", dbPath)

	db, err := gorm.Open(sqlite.Open(dbURL), &gorm.Config{})
	if err != nil {
		return nil, err
	}

	// AutoMigrate creates the users table if it doesn't exist
	err = db.AutoMigrate(&User{})
	if err != nil {
		return nil, err
	}

	return &UserService{DB: db}, nil
}

// RegisterUser adds a new user to the system
func (s *UserService) RegisterUser(email, password string) error {
	// Check if user already exists
	var existingUser User
	result := s.DB.Where("email = ?", email).First(&existingUser)
	if result.Error == nil {
		return gorm.ErrDuplicatedKey
	}

	// Hash the password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	// Create new user
	user := User{
		Email:    email,
		Password: string(hashedPassword),
	}
	_, err = userdata.CreateDirectoryStructureForUser(email)
	return s.DB.Create(&user).Error
}

// AuthenticateUser checks if the provided credentials are valid
func (s *UserService) AuthenticateUser(email, password string) bool {
	var user User
	result := s.DB.Where("email = ?", email).First(&user)
	if result.Error != nil {
		return false
	}

	err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(password))
	return err == nil
}

// LoadInitialUsers loads initial users from a map
func (s *UserService) LoadInitialUsers(initialUsers map[string]string) error {
	for email, password := range initialUsers {
		err := s.RegisterUser(email, password)
		if err != nil && err != gorm.ErrDuplicatedKey {
			return err
		}
	}
	return nil
}
