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
	ID                 uuid.UUID  `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	BusinessID         *uuid.UUID `gorm:"type:uuid;index" json:"business_id,omitempty"`
	CustomerID         uuid.UUID  `gorm:"type:uuid;not null;index" json:"customer_id"`
	ActorUserID        *uuid.UUID `gorm:"type:uuid" json:"actor_user_id,omitempty"`
	OrderID            *uuid.UUID `gorm:"type:uuid;index" json:"order_id,omitempty"`
	RewardID           *uuid.UUID `gorm:"type:uuid;index" json:"reward_id,omitempty"`
	RewardName         string     `gorm:"type:varchar(255);not null;default:''" json:"reward_name,omitempty"`
	DiscountAmountIDR  int64      `gorm:"column:discount_amount_idr;not null;default:0" json:"discount_amount_idr,omitempty"`
	PointsChanged      int        `gorm:"not null" json:"points_changed"`
	PointsBalanceAfter *int       `json:"points_balance_after,omitempty"`
	Reason             string     `gorm:"type:varchar(255);not null;default:''" json:"reason,omitempty"`
	Type               string     `gorm:"type:varchar(30);not null" json:"type"`
	RequestID          *uuid.UUID `gorm:"type:uuid;uniqueIndex" json:"request_id,omitempty"`
	CreatedAt          time.Time  `json:"created_at"`
}
