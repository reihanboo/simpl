package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Business struct {
	ID                    uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	OwnerID               uuid.UUID      `gorm:"type:uuid;not null" json:"owner_id"`
	Name                  string         `gorm:"type:varchar(255);not null" json:"name"`
	Address               string         `gorm:"type:text" json:"address"`
	LoyaltyRupiahPerPoint int64          `gorm:"not null;default:1000" json:"loyalty_rupiah_per_point"`
	CreatedAt             time.Time      `json:"created_at"`
	UpdatedAt             time.Time      `json:"updated_at"`
	DeletedAt             gorm.DeletedAt `gorm:"index" json:"-"`
}

type Subscription struct {
	ID                uuid.UUID  `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	BusinessID        uuid.UUID  `gorm:"type:uuid;not null" json:"business_id"`
	PlanID            string     `gorm:"type:varchar(50);not null" json:"plan_id"`                  // umkm_monthly, enterprise_monthly
	Status            string     `gorm:"type:varchar(50);not null;default:'pending'" json:"status"` // active, pending, expired
	SnapTokenMidtrans string     `gorm:"type:varchar(255)" json:"snap_token_midtrans"`
	MidtransOrderID   string     `gorm:"type:varchar(100);index" json:"-"`
	DurationMonths    int        `gorm:"not null;default:1" json:"duration_months"`
	CurrentPeriodEnd  *time.Time `json:"current_period_end"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
}
