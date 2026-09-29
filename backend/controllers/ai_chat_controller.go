package controllers

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"time"

	"backend/ai"
	"backend/config"
	"backend/models"
	"backend/utils"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

const (
	maxAIChatHistory = 10
	aiChatTimeout    = 60 * time.Second
)

type aiChatHistoryMessage struct {
	Role    string `json:"role" binding:"required,oneof=user assistant"`
	Content string `json:"content" binding:"required,max=4000"`
}

type aiChatRequest struct {
	Message string                 `json:"message" binding:"required,max=1000"`
	History []aiChatHistoryMessage `json:"history" binding:"omitempty,dive"`
}

type aiChatResponse struct {
	Reply     string              `json:"reply"`
	ToolCalls []ai.ToolInvocation `json:"tool_calls,omitempty"`
}

// PostAIChat answers a branch operator's question using DeepSeek with read-only
// database access exposed through an in-process MCP server. The tenant is
// resolved from the authenticated caller and the branch path parameter.
func PostAIChat(c *gin.Context) {
	branchID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		utils.RespondError(c, http.StatusBadRequest, "ID cabang tidak valid")
		return
	}

	userIDValue, exists := c.Get("userID")
	if !exists {
		utils.RespondError(c, http.StatusUnauthorized, "Sesi tidak ditemukan.")
		return
	}
	userID, ok := userIDValue.(uuid.UUID)
	if !ok {
		utils.RespondError(c, http.StatusUnauthorized, "Sesi tidak valid.")
		return
	}

	var payload aiChatRequest
	if err := c.ShouldBindJSON(&payload); err != nil {
		utils.RespondBindError(c, err)
		return
	}

	if !ai.Configured() {
		utils.RespondError(c, http.StatusServiceUnavailable, "Asisten AI belum dikonfigurasi.")
		return
	}

	var branch models.Branch
	if err := config.DB.First(&branch, "id = ?", branchID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			utils.RespondError(c, http.StatusNotFound, "Cabang tidak ditemukan")
		} else {
			utils.RespondError(c, http.StatusInternalServerError, "Gagal memverifikasi cabang")
		}
		return
	}

	var business models.Business
	if err := config.DB.First(&business, "id = ?", branch.BusinessID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			utils.RespondError(c, http.StatusNotFound, "Cabang tidak ditemukan")
		} else {
			utils.RespondError(c, http.StatusInternalServerError, "Gagal memverifikasi bisnis")
		}
		return
	}
	if allowed, err := userCanAccessBusiness(business.ID, userID); err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Gagal memverifikasi akses bisnis")
		return
	} else if !allowed {
		utils.RespondError(c, http.StatusNotFound, "Cabang tidak ditemukan")
		return
	}

	history := make([]ai.Message, 0, len(payload.History))
	for _, message := range payload.History {
		history = append(history, ai.Message{Role: message.Role, Content: message.Content})
	}
	if len(history) > maxAIChatHistory {
		history = history[len(history)-maxAIChatHistory:]
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), aiChatTimeout)
	defer cancel()

	answer, err := ai.Ask(ctx, ai.Scope{
		BusinessID: branch.BusinessID,
		BranchID:   branch.ID,
		BranchName: branch.Name,
	}, history, payload.Message)
	if err != nil {
		if errors.Is(err, ai.ErrNotConfigured) {
			utils.RespondError(c, http.StatusServiceUnavailable, "Asisten AI belum dikonfigurasi.")
			return
		}
		log.Printf("AI chat failed for branch %s: %v", branch.ID, err)
		utils.RespondError(c, http.StatusBadGateway, "Asisten AI sedang tidak dapat dihubungi. Coba lagi nanti.")
		return
	}

	logAIChat(branch, userID, payload.Message, answer.ToolCalls)

	c.JSON(http.StatusOK, aiChatResponse{Reply: answer.Reply, ToolCalls: answer.ToolCalls})
}

func logAIChat(branch models.Branch, userID uuid.UUID, query string, calls []ai.ToolInvocation) {
	encoded, err := json.Marshal(calls)
	if err != nil {
		encoded = []byte("[]")
	}
	entry := models.AIChatLog{
		BusinessID:   branch.BusinessID,
		BranchID:     branch.ID,
		UserID:       userID,
		UserQuery:    query,
		GeneratedSQL: string(encoded),
	}
	if err := config.DB.Create(&entry).Error; err != nil {
		log.Printf("Failed to persist AI chat log: %v", err)
	}
}
