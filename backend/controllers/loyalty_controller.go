package controllers

import (
	"errors"
	"net/http"
	"strings"

	"backend/config"
	"backend/models"
	"backend/utils"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const maxLoyaltyPointsPerAction = 1_000_000
const maxLoyaltyPointBalance = 2_147_483_647
const maxLoyaltyDiscountIDR = 1_000_000_000_000

type loyaltyRewardInput struct {
	Name              string `json:"name" binding:"required,max=255"`
	PointsRequired    int    `json:"points_required" binding:"required,min=1"`
	DiscountAmountIDR int64  `json:"discount_amount_idr" binding:"required,min=1"`
	IsActive          *bool  `json:"is_active"`
}

type loyaltyPointsInput struct {
	PointsChange int    `json:"points_change" binding:"required"`
	Reason       string `json:"reason" binding:"required,max=255"`
	RequestID    string `json:"request_id" binding:"required"`
}

type loyaltyRedemptionInput struct {
	RewardID  string `json:"reward_id" binding:"required"`
	RequestID string `json:"request_id" binding:"required"`
}

var (
	errInsufficientLoyaltyPoints  = errors.New("insufficient loyalty points")
	errLoyaltyMembershipInactive  = errors.New("loyalty membership inactive")
	errLoyaltyRewardUnavailable   = errors.New("loyalty reward unavailable")
	errLoyaltyIdempotencyConflict = errors.New("loyalty request id conflict")
	errLoyaltyPointsLimit         = errors.New("loyalty points limit exceeded")
)

func GetLoyaltyRewards(c *gin.Context) {
	businessID, ok := getAuthorizedEnterpriseBusiness(c)
	if !ok {
		return
	}

	var rewards []models.LoyaltyReward
	if err := config.DB.Where("business_id = ?", businessID).Order("is_active DESC, points_required ASC, created_at ASC").Find(&rewards).Error; err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Gagal mengambil hadiah loyalitas.")
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": rewards})
}

func CreateLoyaltyReward(c *gin.Context) {
	businessID, ok := getAuthorizedEnterpriseBusiness(c)
	if !ok {
		return
	}

	var input loyaltyRewardInput
	if err := c.ShouldBindJSON(&input); err != nil {
		utils.RespondBindError(c, err)
		return
	}
	if err := validateLoyaltyReward(input); err != nil {
		utils.RespondError(c, http.StatusBadRequest, err.Error())
		return
	}

	isActive := true
	if input.IsActive != nil {
		isActive = *input.IsActive
	}
	reward := models.LoyaltyReward{
		BusinessID:        businessID,
		Name:              strings.TrimSpace(input.Name),
		PointsRequired:    input.PointsRequired,
		DiscountAmountIDR: input.DiscountAmountIDR,
		IsActive:          isActive,
	}
	if err := config.DB.Create(&reward).Error; err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Gagal membuat hadiah loyalitas.")
		return
	}
	c.JSON(http.StatusCreated, gin.H{"reward": reward})
}

func UpdateLoyaltyReward(c *gin.Context) {
	businessID, ok := getAuthorizedEnterpriseBusiness(c)
	if !ok {
		return
	}
	rewardID, err := uuid.Parse(c.Param("reward_id"))
	if err != nil {
		utils.RespondError(c, http.StatusBadRequest, "ID hadiah tidak valid.")
		return
	}

	var input loyaltyRewardInput
	if err := c.ShouldBindJSON(&input); err != nil {
		utils.RespondBindError(c, err)
		return
	}
	if err := validateLoyaltyReward(input); err != nil {
		utils.RespondError(c, http.StatusBadRequest, err.Error())
		return
	}

	isActive := true
	if input.IsActive != nil {
		isActive = *input.IsActive
	}
	result := config.DB.Model(&models.LoyaltyReward{}).
		Where("id = ? AND business_id = ?", rewardID, businessID).
		Updates(map[string]interface{}{
			"name":                strings.TrimSpace(input.Name),
			"points_required":     input.PointsRequired,
			"discount_amount_idr": input.DiscountAmountIDR,
			"is_active":           isActive,
		})
	if result.Error != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Gagal memperbarui hadiah loyalitas.")
		return
	}
	if result.RowsAffected == 0 {
		utils.RespondError(c, http.StatusNotFound, "Hadiah loyalitas tidak ditemukan.")
		return
	}

	var reward models.LoyaltyReward
	if err := config.DB.Where("id = ? AND business_id = ?", rewardID, businessID).First(&reward).Error; err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Gagal mengambil hadiah loyalitas.")
		return
	}
	c.JSON(http.StatusOK, gin.H{"reward": reward})
}

func DeleteLoyaltyReward(c *gin.Context) {
	businessID, ok := getAuthorizedEnterpriseBusiness(c)
	if !ok {
		return
	}
	rewardID, err := uuid.Parse(c.Param("reward_id"))
	if err != nil {
		utils.RespondError(c, http.StatusBadRequest, "ID hadiah tidak valid.")
		return
	}

	result := config.DB.Model(&models.LoyaltyReward{}).
		Where("id = ? AND business_id = ?", rewardID, businessID).
		Update("is_active", false)
	if result.Error != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Gagal menonaktifkan hadiah loyalitas.")
		return
	}
	if result.RowsAffected == 0 {
		utils.RespondError(c, http.StatusNotFound, "Hadiah loyalitas tidak ditemukan.")
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Hadiah loyalitas berhasil dinonaktifkan."})
}

func AdjustCustomerPoints(c *gin.Context) {
	businessID, ok := getAuthorizedEnterpriseBusiness(c)
	if !ok {
		return
	}
	customerID, ok := parseCustomerID(c)
	if !ok {
		return
	}
	actorID, ok := currentLoyaltyActorID(c)
	if !ok {
		return
	}

	var input loyaltyPointsInput
	if err := c.ShouldBindJSON(&input); err != nil {
		utils.RespondBindError(c, err)
		return
	}
	input.Reason = strings.TrimSpace(input.Reason)
	if input.PointsChange == 0 || input.PointsChange > maxLoyaltyPointsPerAction || input.PointsChange < -maxLoyaltyPointsPerAction || input.Reason == "" {
		utils.RespondError(c, http.StatusBadRequest, "Perubahan poin harus antara -1.000.000 sampai 1.000.000, tidak boleh nol, dan wajib disertai alasan.")
		return
	}
	requestID, err := parseLoyaltyRequestID(input.RequestID)
	if err != nil {
		utils.RespondError(c, http.StatusBadRequest, "ID permintaan tidak valid.")
		return
	}

	var entry models.LoyaltyPointLog
	idempotent := false
	err = config.DB.Transaction(func(tx *gorm.DB) error {
		var customer models.Customer
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ? AND business_id = ?", customerID, businessID).First(&customer).Error; err != nil {
			return err
		}
		existing, found, err := findLoyaltyRequest(tx, requestID)
		if err != nil {
			return err
		}
		if found {
			if existing.BusinessID == nil || *existing.BusinessID != businessID || existing.CustomerID != customerID || existing.Type != "adjustment" || existing.PointsChanged != input.PointsChange || existing.Reason != input.Reason {
				return errLoyaltyIdempotencyConflict
			}
			entry = existing
			idempotent = true
			return nil
		}
		if !customer.MembershipActive {
			return errLoyaltyMembershipInactive
		}

		newBalance, err := calculateLoyaltyBalance(customer.LoyaltyPoints, input.PointsChange)
		if err != nil {
			return err
		}
		if err := tx.Model(&customer).Update("loyalty_points", newBalance).Error; err != nil {
			return err
		}
		actor := actorID
		request := requestID
		business := businessID
		balanceAfter := newBalance
		entry = models.LoyaltyPointLog{
			BusinessID:         &business,
			CustomerID:         customerID,
			ActorUserID:        &actor,
			PointsChanged:      input.PointsChange,
			PointsBalanceAfter: &balanceAfter,
			Reason:             input.Reason,
			Type:               "adjustment",
			RequestID:          &request,
		}
		return tx.Create(&entry).Error
	})
	if err != nil {
		handleLoyaltyMutationError(c, err)
		return
	}

	respondLoyaltyMutation(c, businessID, customerID, entry, idempotent)
}

func RedeemLoyaltyReward(c *gin.Context) {
	businessID, ok := getAuthorizedEnterpriseBusiness(c)
	if !ok {
		return
	}
	customerID, ok := parseCustomerID(c)
	if !ok {
		return
	}
	actorID, ok := currentLoyaltyActorID(c)
	if !ok {
		return
	}

	var input loyaltyRedemptionInput
	if err := c.ShouldBindJSON(&input); err != nil {
		utils.RespondBindError(c, err)
		return
	}
	rewardID, err := uuid.Parse(input.RewardID)
	if err != nil {
		utils.RespondError(c, http.StatusBadRequest, "ID hadiah tidak valid.")
		return
	}
	requestID, err := parseLoyaltyRequestID(input.RequestID)
	if err != nil {
		utils.RespondError(c, http.StatusBadRequest, "ID permintaan tidak valid.")
		return
	}

	var entry models.LoyaltyPointLog
	idempotent := false
	err = config.DB.Transaction(func(tx *gorm.DB) error {
		var customer models.Customer
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ? AND business_id = ?", customerID, businessID).First(&customer).Error; err != nil {
			return err
		}
		existing, found, err := findLoyaltyRequest(tx, requestID)
		if err != nil {
			return err
		}
		if found {
			if existing.BusinessID == nil || *existing.BusinessID != businessID || existing.CustomerID != customerID || existing.Type != "redeemed" || existing.RewardID == nil || *existing.RewardID != rewardID {
				return errLoyaltyIdempotencyConflict
			}
			entry = existing
			idempotent = true
			return nil
		}
		if !customer.MembershipActive {
			return errLoyaltyMembershipInactive
		}

		var reward models.LoyaltyReward
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ? AND business_id = ? AND is_active = ?", rewardID, businessID, true).
			First(&reward).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return errLoyaltyRewardUnavailable
			}
			return err
		}
		newBalance, err := calculateLoyaltyBalance(customer.LoyaltyPoints, -reward.PointsRequired)
		if err != nil {
			return err
		}
		if err := tx.Model(&customer).Update("loyalty_points", newBalance).Error; err != nil {
			return err
		}
		actor := actorID
		request := requestID
		rewardRef := reward.ID
		business := businessID
		balanceAfter := newBalance
		entry = models.LoyaltyPointLog{
			BusinessID:         &business,
			CustomerID:         customerID,
			ActorUserID:        &actor,
			RewardID:           &rewardRef,
			RewardName:         reward.Name,
			DiscountAmountIDR:  reward.DiscountAmountIDR,
			PointsChanged:      -reward.PointsRequired,
			PointsBalanceAfter: &balanceAfter,
			Reason:             "Penukaran hadiah: " + reward.Name,
			Type:               "redeemed",
			RequestID:          &request,
		}
		return tx.Create(&entry).Error
	})
	if err != nil {
		handleLoyaltyMutationError(c, err)
		return
	}

	respondLoyaltyMutation(c, businessID, customerID, entry, idempotent)
}

func calculateLoyaltyBalance(current, change int) (int, error) {
	if current < 0 {
		return 0, errInsufficientLoyaltyPoints
	}
	balance := int64(current) + int64(change)
	if balance < 0 {
		return 0, errInsufficientLoyaltyPoints
	}
	if balance > maxLoyaltyPointBalance {
		return 0, errLoyaltyPointsLimit
	}
	return int(balance), nil
}

func validateLoyaltyReward(input loyaltyRewardInput) error {
	if strings.TrimSpace(input.Name) == "" || input.PointsRequired < 1 || input.PointsRequired > maxLoyaltyPointsPerAction || input.DiscountAmountIDR < 1 || input.DiscountAmountIDR > maxLoyaltyDiscountIDR {
		return errors.New("Nama hadiah wajib diisi, poin harus valid, dan diskon harus antara Rp1 sampai Rp1.000.000.000.000.")
	}
	return nil
}

func currentLoyaltyActorID(c *gin.Context) (uuid.UUID, bool) {
	userID, exists := c.Get("userID")
	if !exists {
		utils.RespondError(c, http.StatusUnauthorized, "Sesi tidak ditemukan.")
		return uuid.Nil, false
	}
	actorID, ok := userID.(uuid.UUID)
	if !ok {
		utils.RespondError(c, http.StatusUnauthorized, "Sesi tidak valid.")
		return uuid.Nil, false
	}
	return actorID, true
}

func parseLoyaltyRequestID(value string) (uuid.UUID, error) {
	requestID, err := uuid.Parse(strings.TrimSpace(value))
	if err != nil || requestID == uuid.Nil {
		return uuid.Nil, errors.New("invalid request id")
	}
	return requestID, nil
}

func findLoyaltyRequest(tx *gorm.DB, requestID uuid.UUID) (models.LoyaltyPointLog, bool, error) {
	var entry models.LoyaltyPointLog
	err := tx.Where("request_id = ?", requestID).First(&entry).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return entry, false, nil
	}
	return entry, err == nil, err
}

func respondLoyaltyMutation(c *gin.Context, businessID, customerID uuid.UUID, entry models.LoyaltyPointLog, idempotent bool) {
	var customer models.Customer
	if err := config.DB.Where("id = ? AND business_id = ?", customerID, businessID).First(&customer).Error; err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Gagal mengambil saldo poin pelanggan.")
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"entry":      entry,
		"customer":   customer,
		"idempotent": idempotent,
	})
}

func handleLoyaltyMutationError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, gorm.ErrRecordNotFound):
		utils.RespondError(c, http.StatusNotFound, "Pelanggan tidak ditemukan.")
	case errors.Is(err, errInsufficientLoyaltyPoints):
		utils.RespondError(c, http.StatusConflict, "Saldo poin tidak cukup untuk aksi ini.")
	case errors.Is(err, errLoyaltyMembershipInactive):
		utils.RespondError(c, http.StatusConflict, "Pelanggan belum bergabung dengan program loyalitas.")
	case errors.Is(err, errLoyaltyRewardUnavailable):
		utils.RespondError(c, http.StatusConflict, "Hadiah tidak tersedia atau sudah dinonaktifkan.")
	case errors.Is(err, errLoyaltyIdempotencyConflict):
		utils.RespondError(c, http.StatusConflict, "ID permintaan sudah digunakan untuk aksi loyalitas yang berbeda.")
	case errors.Is(err, errLoyaltyPointsLimit):
		utils.RespondError(c, http.StatusConflict, "Saldo poin akan melebihi batas yang didukung.")
	default:
		utils.RespondError(c, http.StatusInternalServerError, "Gagal memperbarui data loyalitas.")
	}
}
