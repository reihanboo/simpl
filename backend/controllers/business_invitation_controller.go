package controllers

import (
	"backend/config"
	"backend/models"
	"backend/utils"
	"errors"
	"fmt"
	"html"
	"log"
	"net/http"
	"net/mail"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/resend/resend-go/v2"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type pendingInvitationResponse struct {
	ID             uuid.UUID `json:"id"`
	BusinessID     uuid.UUID `json:"business_id"`
	BusinessName   string    `json:"business_name"`
	InvitedByName  string    `json:"invited_by_name"`
	InvitedByEmail string    `json:"invited_by_email"`
	CreatedAt      time.Time `json:"created_at"`
}

type businessMemberResponse struct {
	UserID   uuid.UUID `json:"user_id"`
	Email    string    `json:"email"`
	Username string    `json:"username"`
	Role     string    `json:"role"`
	IsOwner  bool      `json:"is_owner"`
}

func ListPendingBusinessInvitations(c *gin.Context) {
	user, ok := authenticatedBusinessUser(c)
	if !ok {
		return
	}

	var invitations []pendingInvitationResponse
	err := config.DB.Table("business_invitations AS invitations").
		Select("invitations.id, invitations.business_id, businesses.name AS business_name, inviter.username AS invited_by_name, inviter.email AS invited_by_email, invitations.created_at").
		Joins("JOIN businesses ON businesses.id = invitations.business_id").
		Joins("JOIN users AS inviter ON inviter.id = invitations.invited_by_id").
		Where("LOWER(invitations.email) = LOWER(?) AND invitations.status = ?", user.Email, "pending").
		Order("invitations.created_at DESC").Scan(&invitations).Error
	if err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Undangan bisnis belum dapat dimuat.")
		return
	}
	if invitations == nil {
		invitations = []pendingInvitationResponse{}
	}
	c.JSON(http.StatusOK, gin.H{"invitations": invitations})
}

func AcceptBusinessInvitation(c *gin.Context) {
	respondToBusinessInvitation(c, true)
}

func DeclineBusinessInvitation(c *gin.Context) {
	respondToBusinessInvitation(c, false)
}

func respondToBusinessInvitation(c *gin.Context, accept bool) {
	user, ok := authenticatedBusinessUser(c)
	if !ok {
		return
	}
	invitationID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		utils.RespondError(c, http.StatusBadRequest, "ID undangan tidak valid.")
		return
	}

	err = config.DB.Transaction(func(tx *gorm.DB) error {
		var invitation models.BusinessInvitation
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&invitation, "id = ?", invitationID).Error; err != nil {
			return err
		}
		if !invitationEmailMatches(invitation.Email, user.Email) {
			return errInvitationEmailMismatch
		}
		if invitation.Status != "pending" {
			return errInvitationNotPending
		}

		if accept {
			member := models.BusinessMember{
				BusinessID: invitation.BusinessID,
				UserID:     user.ID,
				Role:       "co_owner",
			}
			if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&member).Error; err != nil {
				return err
			}
			acceptedAt := time.Now()
			invitation.Status = "accepted"
			invitation.AcceptedAt = &acceptedAt
		} else {
			invitation.Status = "declined"
		}
		return tx.Save(&invitation).Error
	})
	if errors.Is(err, gorm.ErrRecordNotFound) {
		utils.RespondError(c, http.StatusNotFound, "Undangan tidak ditemukan.")
		return
	}
	if errors.Is(err, errInvitationEmailMismatch) {
		utils.RespondError(c, http.StatusForbidden, "Undangan ini ditujukan ke alamat email lain.")
		return
	}
	if errors.Is(err, errInvitationNotPending) {
		utils.RespondError(c, http.StatusConflict, "Undangan ini sudah tidak menunggu respons.")
		return
	}
	if err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Undangan belum dapat diproses.")
		return
	}

	status := "declined"
	if accept {
		status = "accepted"
	}
	c.JSON(http.StatusOK, gin.H{"message": fmt.Sprintf("Invitation %s", status), "status": status})
}

var (
	errInvitationEmailMismatch = errors.New("invitation email does not match user")
	errInvitationNotPending    = errors.New("invitation is not pending")
)

func invitationEmailMatches(invitedEmail, userEmail string) bool {
	return strings.EqualFold(strings.TrimSpace(invitedEmail), strings.TrimSpace(userEmail))
}

func ListBusinessMembers(c *gin.Context) {
	businessID, _, ok := authorizedBusiness(c)
	if !ok {
		return
	}

	var business models.Business
	if err := config.DB.First(&business, "id = ?", businessID).Error; err != nil {
		utils.RespondError(c, http.StatusNotFound, "Bisnis tidak ditemukan.")
		return
	}

	members := make([]businessMemberResponse, 0)
	var owner models.User
	if err := config.DB.Select("id", "email", "username").First(&owner, "id = ?", business.OwnerID).Error; err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Pemilik bisnis belum dapat dimuat.")
		return
	}
	members = append(members, businessMemberResponse{
		UserID: owner.ID, Email: owner.Email, Username: owner.Username, Role: "owner", IsOwner: true,
	})

	var rows []struct {
		UserID   uuid.UUID
		Email    string
		Username string
		Role     string
	}
	if err := config.DB.Table("business_members AS members").
		Select("users.id AS user_id, users.email, users.username, members.role").
		Joins("JOIN users ON users.id = members.user_id").
		Where("members.business_id = ?", businessID).
		Order("users.username ASC").Scan(&rows).Error; err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Anggota bisnis belum dapat dimuat.")
		return
	}
	for _, row := range rows {
		if row.UserID == owner.ID {
			continue
		}
		members = append(members, businessMemberResponse{
			UserID: row.UserID, Email: row.Email, Username: row.Username, Role: row.Role,
		})
	}
	c.JSON(http.StatusOK, gin.H{"members": members})
}

func ListBusinessInvitations(c *gin.Context) {
	businessID, _, ok := authorizedBusiness(c)
	if !ok {
		return
	}
	var invitations []models.BusinessInvitation
	if err := config.DB.Where("business_id = ? AND status = ?", businessID, "pending").Order("created_at DESC").Find(&invitations).Error; err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Undangan bisnis belum dapat dimuat.")
		return
	}
	if invitations == nil {
		invitations = []models.BusinessInvitation{}
	}
	c.JSON(http.StatusOK, gin.H{"invitations": invitations})
}

func InviteBusinessMember(c *gin.Context) {
	businessID, userID, ok := authorizedBusiness(c)
	if !ok {
		return
	}
	var input struct {
		Email string `json:"email" binding:"required,email"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		utils.RespondBindError(c, err)
		return
	}
	input.Email = strings.ToLower(strings.TrimSpace(input.Email))
	if _, err := mail.ParseAddress(input.Email); err != nil {
		utils.RespondError(c, http.StatusBadRequest, "Alamat email tidak valid.")
		return
	}

	var business models.Business
	if err := config.DB.First(&business, "id = ?", businessID).Error; err != nil {
		utils.RespondError(c, http.StatusNotFound, "Bisnis tidak ditemukan.")
		return
	}
	var inviter models.User
	if err := config.DB.Select("id", "username", "email").First(&inviter, "id = ?", userID).Error; err != nil {
		utils.RespondError(c, http.StatusUnauthorized, "Akun tidak ditemukan.")
		return
	}
	if strings.EqualFold(input.Email, inviter.Email) && business.OwnerID == userID {
		utils.RespondError(c, http.StatusBadRequest, "Pemilik bisnis tidak dapat mengundang dirinya sendiri.")
		return
	}
	var existingMember models.BusinessMember
	var targetUser models.User
	err := config.DB.Select("id").First(&targetUser, "LOWER(email) = LOWER(?)", input.Email).Error
	if err == nil {
		if targetUser.ID == business.OwnerID {
			utils.RespondError(c, http.StatusConflict, "Pengguna tersebut sudah menjadi pemilik bisnis.")
			return
		}
		if err := config.DB.First(&existingMember, "business_id = ? AND user_id = ?", businessID, targetUser.ID).Error; err == nil {
			utils.RespondError(c, http.StatusConflict, "Pengguna tersebut sudah menjadi anggota bisnis.")
			return
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			utils.RespondError(c, http.StatusInternalServerError, "Keanggotaan bisnis belum dapat diperiksa.")
			return
		}
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		utils.RespondError(c, http.StatusInternalServerError, "Akun undangan belum dapat diperiksa.")
		return
	}

	invitation := models.BusinessInvitation{
		BusinessID:  businessID,
		Email:       input.Email,
		InvitedByID: userID,
		Status:      "pending",
	}
	if err := config.DB.Create(&invitation).Error; err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "unique") || strings.Contains(strings.ToLower(err.Error()), "duplicate") {
			utils.RespondError(c, http.StatusConflict, "Undangan untuk alamat email ini sudah menunggu respons.")
			return
		}
		utils.RespondError(c, http.StatusInternalServerError, "Undangan bisnis belum dapat dibuat.")
		return
	}

	sendBusinessInvitationEmail(input.Email, business.Name)
	c.JSON(http.StatusCreated, gin.H{
		"invitation": gin.H{"id": invitation.ID, "business_id": invitation.BusinessID, "email": invitation.Email, "status": invitation.Status},
	})
}

func RemoveBusinessMember(c *gin.Context) {
	userIDValue, exists := c.Get("userID")
	ownerID, valid := userIDValue.(uuid.UUID)
	if !exists || !valid {
		utils.RespondError(c, http.StatusUnauthorized, "Sesi Anda tidak valid. Silakan masuk kembali.")
		return
	}
	businessID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		utils.RespondError(c, http.StatusBadRequest, "ID bisnis tidak valid.")
		return
	}
	memberID, err := uuid.Parse(c.Param("user_id"))
	if err != nil {
		utils.RespondError(c, http.StatusBadRequest, "ID co-owner tidak valid.")
		return
	}
	if memberID == ownerID {
		utils.RespondError(c, http.StatusBadRequest, "Pemilik utama tidak dapat menghapus dirinya sendiri sebagai co-owner.")
		return
	}

	var business models.Business
	if err := config.DB.Select("id", "owner_id").First(&business, "id = ?", businessID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			utils.RespondError(c, http.StatusNotFound, "Bisnis tidak ditemukan.")
		} else {
			utils.RespondError(c, http.StatusInternalServerError, "Bisnis belum dapat diverifikasi.")
		}
		return
	}
	if business.OwnerID != ownerID {
		utils.RespondError(c, http.StatusForbidden, "Hanya pemilik utama yang dapat menghapus co-owner.")
		return
	}

	result := config.DB.Where("business_id = ? AND user_id = ?", businessID, memberID).Delete(&models.BusinessMember{})
	if result.Error != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Co-owner belum dapat dihapus.")
		return
	}
	if result.RowsAffected == 0 {
		utils.RespondError(c, http.StatusNotFound, "Co-owner tidak ditemukan dalam bisnis ini.")
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Co-owner removed"})
}

func RevokeBusinessInvitation(c *gin.Context) {
	businessID, _, ok := authorizedBusiness(c)
	if !ok {
		return
	}
	invitationID, err := uuid.Parse(c.Param("invite_id"))
	if err != nil {
		utils.RespondError(c, http.StatusBadRequest, "ID undangan tidak valid.")
		return
	}
	result := config.DB.Model(&models.BusinessInvitation{}).
		Where("id = ? AND business_id = ? AND status = ?", invitationID, businessID, "pending").
		Update("status", "revoked")
	if result.Error != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Undangan belum dapat dicabut.")
		return
	}
	if result.RowsAffected == 0 {
		utils.RespondError(c, http.StatusNotFound, "Undangan aktif tidak ditemukan.")
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Invitation revoked"})
}

func authenticatedBusinessUser(c *gin.Context) (models.User, bool) {
	userIDValue, exists := c.Get("userID")
	userID, valid := userIDValue.(uuid.UUID)
	if !exists || !valid {
		utils.RespondError(c, http.StatusUnauthorized, "Sesi Anda tidak valid. Silakan masuk kembali.")
		return models.User{}, false
	}
	var user models.User
	if err := config.DB.Select("id", "email", "username").First(&user, "id = ?", userID).Error; err != nil {
		utils.RespondError(c, http.StatusUnauthorized, "Akun tidak ditemukan.")
		return models.User{}, false
	}
	return user, true
}

func authorizedBusiness(c *gin.Context) (uuid.UUID, uuid.UUID, bool) {
	userIDValue, exists := c.Get("userID")
	userID, valid := userIDValue.(uuid.UUID)
	if !exists || !valid {
		utils.RespondError(c, http.StatusUnauthorized, "Sesi Anda tidak valid. Silakan masuk kembali.")
		return uuid.Nil, uuid.Nil, false
	}
	businessID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		utils.RespondError(c, http.StatusBadRequest, "ID bisnis tidak valid.")
		return uuid.Nil, uuid.Nil, false
	}
	var count int64
	err = config.DB.Model(&models.Business{}).
		Where("id = ? AND owner_id = ?", businessID, userID).Count(&count).Error
	if err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Akses bisnis belum dapat diperiksa.")
		return uuid.Nil, uuid.Nil, false
	}
	if count == 0 {
		err = config.DB.Model(&models.BusinessMember{}).
			Where("business_id = ? AND user_id = ?", businessID, userID).Count(&count).Error
		if err != nil {
			utils.RespondError(c, http.StatusInternalServerError, "Akses bisnis belum dapat diperiksa.")
			return uuid.Nil, uuid.Nil, false
		}
	}
	if count == 0 {
		utils.RespondError(c, http.StatusForbidden, "Anda tidak memiliki akses ke bisnis ini.")
		return uuid.Nil, uuid.Nil, false
	}
	return businessID, userID, true
}

func sendBusinessInvitationEmail(to, businessName string) {
	apiKey := os.Getenv("RESEND_API_KEY")
	if apiKey == "" {
		return
	}
	frontendURL := strings.TrimRight(os.Getenv("FRONTEND_URL"), "/")
	if frontendURL == "" {
		frontendURL = "http://localhost:3000"
	}
	dashboardURL := frontendURL + "/dashboard"
	body := fmt.Sprintf(`<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
		<h1>SIMPL business invitation</h1>
		<p>You have been invited to co-own <strong>%s</strong>.</p>
		<p>Sign in to SIMPL to review and accept or decline this invitation in your inbox.</p>
		<p><a href="%s">Open your dashboard</a></p>
		<p>If you did not expect this invitation, you can ignore this email. Your inbox is the source of truth for pending invitations.</p>
	</div>`, html.EscapeString(businessName), html.EscapeString(dashboardURL))
	_, err := resend.NewClient(apiKey).Emails.Send(&resend.SendEmailRequest{
		From:    "noreply.simpl-erm.tech",
		To:      []string{to},
		Subject: "You are invited to co-own " + businessName + " on SIMPL",
		Html:    body,
	})
	if err != nil {
		log.Printf("Failed to send business invitation email to %s: %v", to, err)
	}
}
