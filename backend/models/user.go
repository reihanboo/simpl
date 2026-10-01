package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type User struct {
	ID                     uuid.UUID  `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Email                  string     `gorm:"type:varchar(100);uniqueIndex;not null" json:"email"`
	Phone                  string     `gorm:"type:varchar(20)" json:"phone"`
	Username               string     `gorm:"type:varchar(50);not null" json:"username"`
	PasswordHash           string     `gorm:"type:varchar(255);not null" json:"-"`
	IsVerified             bool       `gorm:"default:false" json:"is_verified"`
	RequiresPasswordChange bool       `gorm:"default:false" json:"requires_password_change"`
	OTPCode                *string    `gorm:"type:varchar(6)" json:"-"`
	OTPExpiresAt           *time.Time `json:"-"`
	OTPAttempts            int        `gorm:"default:0" json:"-"`
	ResetPasswordToken     *string    `gorm:"type:varchar(255)" json:"-"`
	ResetPasswordExpiresAt *time.Time `json:"-"`
	CreatedAt              time.Time  `json:"created_at"`
	UpdatedAt              time.Time  `json:"updated_at"`
}

func (u *User) BeforeCreate(tx *gorm.DB) (err error) {
	if u.ID == uuid.Nil {
		u.ID = uuid.New()
	}
	return
}
