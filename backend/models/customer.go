package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Customer struct {
	ID                     uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	BusinessID             uuid.UUID      `gorm:"type:uuid;not null;index" json:"business_id"`
	Name                   string         `gorm:"type:varchar(255);not null" json:"name"`
	Phone                  string         `gorm:"type:varchar(20)" json:"phone"`
	Email                  string         `gorm:"type:varchar(100)" json:"email"`
	LoyaltyPoints          int            `gorm:"not null;default:0" json:"loyalty_points"`
	MembershipActive       bool           `gorm:"not null;default:true" json:"membership_active"`
	SpecialDiscountPercent int            `gorm:"not null;default:0" json:"special_discount_percent"`
	CreatedAt              time.Time      `json:"created_at"`
	UpdatedAt              time.Time      `json:"updated_at"`
	DeletedAt              gorm.DeletedAt `gorm:"index" json:"-"`
}
