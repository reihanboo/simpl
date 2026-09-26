package models

import (
	"time"

	"github.com/google/uuid"
)

type Order struct {
	ID                uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	BusinessID        uuid.UUID `gorm:"type:uuid;not null" json:"business_id"`
	BranchID          uuid.UUID `gorm:"type:uuid;not null" json:"branch_id"`
	CashierID         uuid.UUID `gorm:"type:uuid;not null" json:"cashier_id"`
	OrderNumber       string    `gorm:"type:varchar(50);not null;unique" json:"order_number"`
	TotalAmountIDR    int64     `gorm:"not null" json:"total_amount_idr"`
	DiscountAmountIDR int64     `gorm:"default:0" json:"discount_amount_idr"`
	PaymentMethod     string    `gorm:"type:varchar(20);not null" json:"payment_method"`
	PaymentStatus     string    `gorm:"type:varchar(20);default:'paid'" json:"payment_status"`
	CreatedAt         time.Time `json:"created_at"`

	Items []OrderItem `gorm:"foreignKey:OrderID" json:"items"`
}

type OrderItem struct {
	ID            uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	OrderID       uuid.UUID `gorm:"type:uuid;not null" json:"order_id"`
	ProductID     uuid.UUID `gorm:"type:uuid;not null" json:"product_id"`
	Qty           int       `gorm:"not null" json:"qty"`
	UnitPriceIDR  int64     `gorm:"not null" json:"unit_price_idr"`
	SubtotalIDR   int64     `gorm:"not null" json:"subtotal_idr"`

	Product Product `gorm:"foreignKey:ProductID" json:"product"`
}
