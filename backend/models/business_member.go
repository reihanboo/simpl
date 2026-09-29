package models

import (
	"time"

	"github.com/google/uuid"
)

// BusinessMember grants a user co-owner access to a business after accepting
// an invitation. Business owners remain represented by Business.OwnerID.
type BusinessMember struct {
	BusinessID uuid.UUID `gorm:"type:uuid;primaryKey" json:"business_id"`
	UserID     uuid.UUID `gorm:"type:uuid;primaryKey" json:"user_id"`
	Role       string    `gorm:"type:varchar(30);not null;default:'co_owner'" json:"role"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

type BusinessInvitation struct {
	ID          uuid.UUID  `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	BusinessID  uuid.UUID  `gorm:"type:uuid;not null;index:idx_business_invitation_pending,unique,where:status = 'pending',priority:1" json:"business_id"`
	Email       string     `gorm:"type:varchar(100);not null;index:idx_business_invitation_pending,unique,where:status = 'pending',priority:2" json:"email"`
	InvitedByID uuid.UUID  `gorm:"type:uuid;not null" json:"invited_by_id"`
	Status      string     `gorm:"type:varchar(20);not null;default:'pending';index" json:"status"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
	AcceptedAt  *time.Time `json:"accepted_at,omitempty"`
}
