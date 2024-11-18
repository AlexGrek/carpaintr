package models

// CompanyInfo represents comprehensive company information
type CompanyInfo struct {
	Email       string      `json:"email"`
	License     LicenseInfo `json:"license"`
	CompanyName string      `json:"company_name"`
	CurrentTime string      `json:"current_time"`
}
