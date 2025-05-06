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

// ChangePassword changes a user's password if the current password is correct
func (s *UserService) ChangePassword(email, currentPassword, newPassword string) error {
	// First verify the current password
	if !s.AuthenticateUser(email, currentPassword) {
		return fmt.Errorf("current password is incorrect")
	}

	// Hash the new password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("error hashing new password: %v", err)
	}

	// Update the password in the database
	result := s.DB.Model(&User{}).Where("email = ?", email).Update("password", string(hashedPassword))
	if result.Error != nil {
		return fmt.Errorf("error updating password: %v", result.Error)
	}

	if result.RowsAffected == 0 {
		return fmt.Errorf("user not found")
	}

	return nil
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

// ListUsers returns all users in the system
func (s *UserService) ListUsers() ([]User, error) {
	var users []User
	result := s.DB.Model(&User{}).Select("id, email, created_at, updated_at").Find(&users)
	if result.Error != nil {
		return nil, fmt.Errorf("error fetching users: %v", result.Error)
	}

	// Create a sanitized list of users (without password hashes)
	sanitizedUsers := make([]User, len(users))
	for i, user := range users {
		sanitizedUsers[i] = User{
			Model: gorm.Model{
				ID:        user.ID,
				CreatedAt: user.CreatedAt,
				UpdatedAt: user.UpdatedAt,
			},
			Email: user.Email,
			// Password field is intentionally left empty for security
		}
	}

	return sanitizedUsers, nil
}
