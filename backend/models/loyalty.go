package models

import (
	"time"

	"github.com/google/uuid"
)

type LoyaltyReward struct {
	ID                uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	BusinessID        uuid.UUID `gorm:"type:uuid;not null;index" json:"business_id"`
	Name              string    `gorm:"type:varchar(255);not null" json:"name"`
	PointsRequired    int       `gorm:"not null" json:"points_required"`
	DiscountAmountIDR int64     `gorm:"column:discount_amount_idr;not null;default:0" json:"discount_amount_idr"`
	IsActive          bool      `gorm:"not null;default:true" json:"is_active"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}

type LoyaltyPointLog struct {
	ID            uuid.UUID  `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	CustomerID    uuid.UUID  `gorm:"type:uuid;not null;index" json:"customer_id"`
	OrderID       *uuid.UUID `gorm:"type:uuid;index" json:"order_id,omitempty"`
	PointsChanged int        `gorm:"not null" json:"points_changed"`
	Type          string     `gorm:"type:varchar(30);not null" json:"type"`
	CreatedAt     time.Time  `json:"created_at"`
}
