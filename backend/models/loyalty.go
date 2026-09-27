package models

import (
	"time"

	"github.com/google/uuid"
)

type LoyaltyReward struct {
	ID                   uuid.UUID   `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	BusinessID           uuid.UUID   `gorm:"type:uuid;not null;index" json:"business_id"`
	Name                 string      `gorm:"type:varchar(255);not null" json:"name"`
	Description          string      `gorm:"type:varchar(1000);not null;default:''" json:"description"`
	TermsAndConditions   string      `gorm:"type:varchar(2000);not null;default:''" json:"terms_and_conditions"`
	PointsRequired       int         `gorm:"not null" json:"points_required"`
	DiscountType         string      `gorm:"type:varchar(20);not null;default:fixed" json:"discount_type"`
	DiscountAmountIDR    int64       `gorm:"column:discount_amount_idr;not null;default:0" json:"discount_amount_idr"`
	DiscountPercentage   float64     `gorm:"type:decimal(5,2);not null;default:0" json:"discount_percentage"`
	MaxDiscountAmountIDR *int64      `gorm:"column:max_discount_amount_idr" json:"max_discount_amount_idr,omitempty"`
	UsageLimit           *int        `json:"usage_limit,omitempty"`
	UsageCount           int         `gorm:"not null;default:0" json:"usage_count"`
	PerCustomerLimit     *int        `json:"per_customer_limit,omitempty"`
	StartsAt             *time.Time  `json:"starts_at,omitempty"`
	EndsAt               *time.Time  `json:"ends_at,omitempty"`
	CustomerIDs          []uuid.UUID `gorm:"-" json:"customer_ids"`
	IsActive             bool        `gorm:"not null;default:true" json:"is_active"`
	CreatedAt            time.Time   `json:"created_at"`
	UpdatedAt            time.Time   `json:"updated_at"`
}

type LoyaltyRewardCustomer struct {
	RewardID   uuid.UUID `gorm:"type:uuid;primaryKey" json:"reward_id"`
	CustomerID uuid.UUID `gorm:"type:uuid;primaryKey" json:"customer_id"`
	CreatedAt  time.Time `json:"created_at"`
}

type LoyaltyPointLog struct {
	ID                   uuid.UUID  `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	BusinessID           *uuid.UUID `gorm:"type:uuid;index" json:"business_id,omitempty"`
	CustomerID           uuid.UUID  `gorm:"type:uuid;not null;index" json:"customer_id"`
	ActorUserID          *uuid.UUID `gorm:"type:uuid" json:"actor_user_id,omitempty"`
	OrderID              *uuid.UUID `gorm:"type:uuid;index" json:"order_id,omitempty"`
	RewardID             *uuid.UUID `gorm:"type:uuid;index" json:"reward_id,omitempty"`
	RewardName           string     `gorm:"type:varchar(255);not null;default:''" json:"reward_name,omitempty"`
	DiscountAmountIDR    int64      `gorm:"column:discount_amount_idr;not null;default:0" json:"discount_amount_idr,omitempty"`
	DiscountType         string     `gorm:"type:varchar(20);not null;default:''" json:"discount_type,omitempty"`
	DiscountPercentage   float64    `gorm:"type:decimal(5,2);not null;default:0" json:"discount_percentage,omitempty"`
	MaxDiscountAmountIDR *int64     `gorm:"column:max_discount_amount_idr" json:"max_discount_amount_idr,omitempty"`
	PointsChanged        int        `gorm:"not null" json:"points_changed"`
	PointsBalanceAfter   *int       `json:"points_balance_after,omitempty"`
	Reason               string     `gorm:"type:varchar(255);not null;default:''" json:"reason,omitempty"`
	Type                 string     `gorm:"type:varchar(30);not null" json:"type"`
	RequestID            *uuid.UUID `gorm:"type:uuid;uniqueIndex" json:"request_id,omitempty"`
	CreatedAt            time.Time  `json:"created_at"`
}
