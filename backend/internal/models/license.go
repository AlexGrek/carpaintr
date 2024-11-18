package models

// LicenseInfo represents a company's licensing details
type LicenseInfo struct {
	IsActive   bool   `json:"is_active"`
	EndsDate   string `json:"ends_date"`
	LicensedTo string `json:"licensed_to"`
	Level      string `json:"level"`
}
