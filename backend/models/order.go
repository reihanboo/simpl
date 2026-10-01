package models

import (
	"time"

	"github.com/google/uuid"
)

type Order struct {
	ID                uuid.UUID   `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	BusinessID        uuid.UUID   `gorm:"type:uuid;not null;index" json:"business_id"`
	BranchID          uuid.UUID   `gorm:"type:uuid;not null;index" json:"branch_id"`
	CashierID         uuid.UUID   `gorm:"type:uuid;not null" json:"cashier_id"`
	CustomerID        *uuid.UUID  `gorm:"type:uuid;index" json:"customer_id,omitempty"`
	LoyaltyVoucherID  *uuid.UUID  `gorm:"type:uuid;index" json:"loyalty_voucher_id,omitempty"`
	OrderNumber       string      `gorm:"type:varchar(100);not null" json:"order_number"`
	TotalAmountIDR    int64       `gorm:"column:total_amount_idr;not null;default:0" json:"total_amount_idr"`
	DiscountAmountIDR int64       `gorm:"column:discount_amount_idr;not null;default:0" json:"discount_amount_idr"`
	PaymentMethod     string      `gorm:"type:varchar(30);not null" json:"payment_method"`
	PaymentStatus     string      `gorm:"type:varchar(30);not null" json:"payment_status"`
	CreatedAt         time.Time   `json:"created_at"`
	Items             []OrderItem `gorm:"foreignKey:OrderID;constraint:OnDelete:CASCADE" json:"-"`
	Customer          *Customer   `gorm:"foreignKey:CustomerID" json:"-"`
}

type OrderItem struct {
	ID           uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	OrderID      uuid.UUID `gorm:"type:uuid;not null;index" json:"order_id"`
	ProductID    uuid.UUID `gorm:"type:uuid;not null;index" json:"product_id"`
	Qty          int       `gorm:"not null" json:"qty"`
	UnitPriceIDR int64     `gorm:"column:unit_price_idr;not null;default:0" json:"unit_price_idr"`
	SubtotalIDR  int64     `gorm:"column:subtotal_idr;not null;default:0" json:"subtotal_idr"`
	Product      Product   `gorm:"foreignKey:ProductID" json:"-"`
}
