package models

import (
	"time"

	"github.com/google/uuid"
)

// AIChatLog records a single assistant question and the MCP tool calls the
// model made to answer it, mirroring the ai_chat_logs table from the ERD.
// GeneratedSQL stores the serialized tool calls (the assistant answers through
// curated tools rather than free-form SQL).
type AIChatLog struct {
	ID           uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	BusinessID   uuid.UUID `gorm:"type:uuid;not null;index" json:"business_id"`
	BranchID     uuid.UUID `gorm:"type:uuid;not null;index" json:"branch_id"`
	UserID       uuid.UUID `gorm:"type:uuid;not null" json:"user_id"`
	UserQuery    string    `gorm:"type:text;not null" json:"user_query"`
	GeneratedSQL string    `gorm:"type:text" json:"generated_sql"`
	CreatedAt    time.Time `json:"created_at"`
}
