package models

import (
	"time"

	"github.com/google/uuid"
)

// Product represents an item in the business's master catalog
type Product struct {
	ID                uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	BusinessID        uuid.UUID `gorm:"type:uuid;not null;index" json:"business_id"`
	Name              string    `gorm:"type:varchar(255);not null" json:"name"`
	SKU               string    `gorm:"type:varchar(100);not null" json:"sku"`
	CostPriceIDR      int64     `gorm:"not null" json:"cost_price_idr"`
	SellingPriceIDR   int64     `gorm:"not null" json:"selling_price_idr"`
	LowStockThreshold int       `gorm:"not null;default:10" json:"low_stock_threshold"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`

	// Associations
	BranchInventories []BranchInventory `gorm:"foreignKey:ProductID" json:"branch_inventories,omitempty"`
}

// BranchInventory represents the stock level of a product at a specific branch
type BranchInventory struct {
	ID         uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	BranchID   uuid.UUID `gorm:"type:uuid;not null;index" json:"branch_id"`
	ProductID  uuid.UUID `gorm:"type:uuid;not null;index" json:"product_id"`
	CurrentStock int       `gorm:"not null;default:0" json:"current_stock"`
	UpdatedAt  time.Time `json:"updated_at"`

	// Associations
	Product Product `gorm:"foreignKey:ProductID" json:"product,omitempty"`
}

// StockMovement represents any change in inventory stock levels
type StockMovement struct {
	ID         uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	BranchID   uuid.UUID `gorm:"type:uuid;not null;index" json:"branch_id"`
	ProductID  uuid.UUID `gorm:"type:uuid;not null;index" json:"product_id"`
	UserID     uuid.UUID `gorm:"type:uuid;not null" json:"user_id"` // actor who triggered it
	QtyChange  int       `gorm:"not null" json:"qty_change"`        // + restock/adjustment, - sale
	Reason     string    `gorm:"type:varchar(50);not null" json:"reason"` // sale | restock | adjustment | return | po_receive
	CreatedAt  time.Time `json:"created_at"`

	// Associations
	Product Product `gorm:"foreignKey:ProductID" json:"product,omitempty"`
}
