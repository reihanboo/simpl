package models

import (
	"time"

	"github.com/google/uuid"
)

type Branch struct {
	ID         uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	BusinessID uuid.UUID `gorm:"type:uuid;not null" json:"business_id"`
	Name       string    `gorm:"type:varchar(255);not null" json:"name"`
	Address    string    `gorm:"type:text" json:"address"`
	CreatedAt  time.Time `json:"created_at"`
}
