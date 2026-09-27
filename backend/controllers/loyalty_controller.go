package controllers

import (
	"errors"
	"net/http"
	"strings"
	"time"

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
	Name                 string      `json:"name" binding:"required,max=255"`
	Description          string      `json:"description" binding:"max=1000"`
	TermsAndConditions   string      `json:"terms_and_conditions" binding:"max=2000"`
	PointsRequired       int         `json:"points_required" binding:"required,min=1"`
	DiscountType         string      `json:"discount_type"`
	DiscountAmountIDR    int64       `json:"discount_amount_idr"`
	DiscountPercentage   float64     `json:"discount_percentage"`
	MaxDiscountAmountIDR *int64      `json:"max_discount_amount_idr"`
	UsageLimit           *int        `json:"usage_limit"`
	PerCustomerLimit     *int        `json:"per_customer_limit"`
	StartsAt             *time.Time  `json:"starts_at"`
	EndsAt               *time.Time  `json:"ends_at"`
	CustomerIDs          []uuid.UUID `json:"customer_ids"`
	IsActive             *bool       `json:"is_active"`
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
	errInsufficientLoyaltyPoints     = errors.New("insufficient loyalty points")
	errLoyaltyMembershipInactive     = errors.New("loyalty membership inactive")
	errLoyaltyRewardUnavailable      = errors.New("loyalty reward unavailable")
	errLoyaltyRewardLimitReached     = errors.New("loyalty reward limit reached")
	errLoyaltyCustomerTargetsInvalid = errors.New("selected customers must be unique, valid, and belong to this business")
	errLoyaltyIdempotencyConflict    = errors.New("loyalty request id conflict")
	errLoyaltyPointsLimit            = errors.New("loyalty points limit exceeded")
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
	if err := populateLoyaltyRewardCustomerIDs(config.DB, rewards); err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Gagal mengambil target pelanggan hadiah.")
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
	if err := validateLoyaltyCustomerIDs(input.CustomerIDs); err != nil {
		utils.RespondError(c, http.StatusBadRequest, err.Error())
		return
	}

	isActive := true
	if input.IsActive != nil {
		isActive = *input.IsActive
	}
	reward := loyaltyRewardFromInput(businessID, input, isActive)
	err := config.DB.Transaction(func(tx *gorm.DB) error {
		if err := validateRewardCustomerOwnership(tx, businessID, input.CustomerIDs); err != nil {
			return err
		}
		if err := tx.Create(&reward).Error; err != nil {
			return err
		}
		return replaceLoyaltyRewardCustomers(tx, reward.ID, input.CustomerIDs)
	})
	if err != nil {
		if errors.Is(err, errLoyaltyCustomerTargetsInvalid) {
			utils.RespondError(c, http.StatusBadRequest, err.Error())
			return
		}
		utils.RespondError(c, http.StatusInternalServerError, "Gagal membuat hadiah loyalitas.")
		return
	}
	reward.CustomerIDs = append([]uuid.UUID{}, input.CustomerIDs...)
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
	if err := validateLoyaltyCustomerIDs(input.CustomerIDs); err != nil {
		utils.RespondError(c, http.StatusBadRequest, err.Error())
		return
	}

	isActive := true
	if input.IsActive != nil {
		isActive = *input.IsActive
	}
	var missing bool
	err = config.DB.Transaction(func(tx *gorm.DB) error {
		if err := validateRewardCustomerOwnership(tx, businessID, input.CustomerIDs); err != nil {
			return err
		}
		result := tx.Model(&models.LoyaltyReward{}).
			Where("id = ? AND business_id = ?", rewardID, businessID).
			Updates(loyaltyRewardUpdates(input, isActive))
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			missing = true
			return nil
		}
		return replaceLoyaltyRewardCustomers(tx, rewardID, input.CustomerIDs)
	})
	if err != nil {
		if errors.Is(err, errLoyaltyCustomerTargetsInvalid) {
			utils.RespondError(c, http.StatusBadRequest, err.Error())
			return
		}
		utils.RespondError(c, http.StatusInternalServerError, "Gagal memperbarui hadiah loyalitas.")
		return
	}
	if missing {
		utils.RespondError(c, http.StatusNotFound, "Hadiah loyalitas tidak ditemukan.")
		return
	}

	var reward models.LoyaltyReward
	if err := config.DB.Where("id = ? AND business_id = ?", rewardID, businessID).First(&reward).Error; err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Gagal mengambil hadiah loyalitas.")
		return
	}
	reward.CustomerIDs = append([]uuid.UUID{}, input.CustomerIDs...)
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
		now := time.Now()
		if (reward.StartsAt != nil && now.Before(*reward.StartsAt)) || (reward.EndsAt != nil && !now.Before(*reward.EndsAt)) {
			return errLoyaltyRewardUnavailable
		}
		if reward.UsageLimit != nil && reward.UsageCount >= *reward.UsageLimit {
			return errLoyaltyRewardLimitReached
		}
		var targetCount int64
		if err := tx.Model(&models.LoyaltyRewardCustomer{}).
			Where("reward_id = ?", reward.ID).Count(&targetCount).Error; err != nil {
			return err
		}
		if targetCount > 0 {
			var eligible int64
			if err := tx.Model(&models.LoyaltyRewardCustomer{}).
				Where("reward_id = ? AND customer_id = ?", reward.ID, customerID).Count(&eligible).Error; err != nil {
				return err
			}
			if eligible == 0 {
				return errLoyaltyRewardUnavailable
			}
		}
		if reward.PerCustomerLimit != nil {
			var customerRedemptions int64
			if err := tx.Model(&models.LoyaltyPointLog{}).
				Where("reward_id = ? AND customer_id = ? AND type = ?", reward.ID, customerID, "redeemed").
				Count(&customerRedemptions).Error; err != nil {
				return err
			}
			if customerRedemptions >= int64(*reward.PerCustomerLimit) {
				return errLoyaltyRewardLimitReached
			}
		}
		newBalance, err := calculateLoyaltyBalance(customer.LoyaltyPoints, -reward.PointsRequired)
		if err != nil {
			return err
		}
		if err := tx.Model(&customer).Update("loyalty_points", newBalance).Error; err != nil {
			return err
		}
		if err := tx.Model(&reward).UpdateColumn("usage_count", gorm.Expr("usage_count + 1")).Error; err != nil {
			return err
		}
		actor := actorID
		request := requestID
		rewardRef := reward.ID
		business := businessID
		balanceAfter := newBalance
		entry = models.LoyaltyPointLog{
			BusinessID:           &business,
			CustomerID:           customerID,
			ActorUserID:          &actor,
			RewardID:             &rewardRef,
			RewardName:           reward.Name,
			DiscountAmountIDR:    reward.DiscountAmountIDR,
			DiscountType:         reward.DiscountType,
			DiscountPercentage:   reward.DiscountPercentage,
			MaxDiscountAmountIDR: reward.MaxDiscountAmountIDR,
			PointsChanged:        -reward.PointsRequired,
			PointsBalanceAfter:   &balanceAfter,
			Reason:               "Penukaran hadiah: " + reward.Name,
			Type:                 "redeemed",
			RequestID:            &request,
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
	discountType := normalizedLoyaltyDiscountType(input.DiscountType)
	if strings.TrimSpace(input.Name) == "" || input.PointsRequired < 1 || input.PointsRequired > maxLoyaltyPointsPerAction {
		return errors.New("Nama hadiah wajib diisi dan poin harus antara 1 sampai 1.000.000.")
	}
	if discountType == "fixed" {
		if input.DiscountAmountIDR < 1 || input.DiscountAmountIDR > maxLoyaltyDiscountIDR || input.DiscountPercentage != 0 || input.MaxDiscountAmountIDR != nil {
			return errors.New("Diskon tetap harus antara Rp1 sampai Rp1.000.000.000.000 dan tidak boleh memakai batas diskon persentase.")
		}
	} else if discountType == "percentage" {
		if input.DiscountAmountIDR != 0 || input.DiscountPercentage <= 0 || input.DiscountPercentage > 100 {
			return errors.New("Diskon persentase harus lebih dari 0 sampai 100 dan tidak boleh mengisi nominal diskon tetap.")
		}
		if input.MaxDiscountAmountIDR != nil && (*input.MaxDiscountAmountIDR < 1 || *input.MaxDiscountAmountIDR > maxLoyaltyDiscountIDR) {
			return errors.New("Batas nominal diskon persentase harus antara Rp1 sampai Rp1.000.000.000.000.")
		}
	} else {
		return errors.New("Tipe diskon harus fixed atau percentage.")
	}
	if input.UsageLimit != nil && (*input.UsageLimit < 1 || *input.UsageLimit > maxLoyaltyPointBalance) {
		return errors.New("Batas total penukaran harus antara 1 sampai 2.147.483.647.")
	}
	if input.PerCustomerLimit != nil && (*input.PerCustomerLimit < 1 || *input.PerCustomerLimit > maxLoyaltyPointBalance) {
		return errors.New("Batas penukaran per pelanggan harus antara 1 sampai 2.147.483.647.")
	}
	if input.StartsAt != nil && input.EndsAt != nil && !input.EndsAt.After(*input.StartsAt) {
		return errors.New("Waktu berakhir harus setelah waktu mulai.")
	}
	return nil
}

func validateLoyaltyCustomerIDs(customerIDs []uuid.UUID) error {
	seen := make(map[uuid.UUID]struct{}, len(customerIDs))
	for _, customerID := range customerIDs {
		if customerID == uuid.Nil {
			return errLoyaltyCustomerTargetsInvalid
		}
		if _, exists := seen[customerID]; exists {
			return errLoyaltyCustomerTargetsInvalid
		}
		seen[customerID] = struct{}{}
	}
	return nil
}

func validateRewardCustomerOwnership(tx *gorm.DB, businessID uuid.UUID, customerIDs []uuid.UUID) error {
	if len(customerIDs) == 0 {
		return nil
	}
	var count int64
	if err := tx.Model(&models.Customer{}).
		Where("business_id = ? AND deleted_at IS NULL AND id IN ?", businessID, customerIDs).
		Count(&count).Error; err != nil {
		return err
	}
	if count != int64(len(customerIDs)) {
		return errLoyaltyCustomerTargetsInvalid
	}
	return nil
}

func replaceLoyaltyRewardCustomers(tx *gorm.DB, rewardID uuid.UUID, customerIDs []uuid.UUID) error {
	if err := tx.Where("reward_id = ?", rewardID).Delete(&models.LoyaltyRewardCustomer{}).Error; err != nil {
		return err
	}
	if len(customerIDs) == 0 {
		return nil
	}
	assignments := make([]models.LoyaltyRewardCustomer, 0, len(customerIDs))
	for _, customerID := range customerIDs {
		assignments = append(assignments, models.LoyaltyRewardCustomer{RewardID: rewardID, CustomerID: customerID})
	}
	return tx.Create(&assignments).Error
}

func populateLoyaltyRewardCustomerIDs(db *gorm.DB, rewards []models.LoyaltyReward) error {
	for i := range rewards {
		rewards[i].CustomerIDs = make([]uuid.UUID, 0)
	}
	if len(rewards) == 0 {
		return nil
	}
	rewardIDs := make([]uuid.UUID, 0, len(rewards))
	for _, reward := range rewards {
		rewardIDs = append(rewardIDs, reward.ID)
	}
	var assignments []models.LoyaltyRewardCustomer
	if err := db.Where("reward_id IN ?", rewardIDs).Order("customer_id ASC").Find(&assignments).Error; err != nil {
		return err
	}
	indexByRewardID := make(map[uuid.UUID]int, len(rewards))
	for index := range rewards {
		indexByRewardID[rewards[index].ID] = index
	}
	for _, assignment := range assignments {
		if index, found := indexByRewardID[assignment.RewardID]; found {
			rewards[index].CustomerIDs = append(rewards[index].CustomerIDs, assignment.CustomerID)
		}
	}
	return nil
}

func normalizedLoyaltyDiscountType(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	if value == "" {
		return "fixed"
	}
	return value
}

func loyaltyRewardFromInput(businessID uuid.UUID, input loyaltyRewardInput, isActive bool) models.LoyaltyReward {
	return models.LoyaltyReward{
		BusinessID:           businessID,
		Name:                 strings.TrimSpace(input.Name),
		Description:          strings.TrimSpace(input.Description),
		TermsAndConditions:   strings.TrimSpace(input.TermsAndConditions),
		PointsRequired:       input.PointsRequired,
		DiscountType:         normalizedLoyaltyDiscountType(input.DiscountType),
		DiscountAmountIDR:    input.DiscountAmountIDR,
		DiscountPercentage:   input.DiscountPercentage,
		MaxDiscountAmountIDR: input.MaxDiscountAmountIDR,
		UsageLimit:           input.UsageLimit,
		PerCustomerLimit:     input.PerCustomerLimit,
		StartsAt:             input.StartsAt,
		EndsAt:               input.EndsAt,
		IsActive:             isActive,
	}
}

func loyaltyRewardUpdates(input loyaltyRewardInput, isActive bool) map[string]interface{} {
	return map[string]interface{}{
		"name":                    strings.TrimSpace(input.Name),
		"description":             strings.TrimSpace(input.Description),
		"terms_and_conditions":    strings.TrimSpace(input.TermsAndConditions),
		"points_required":         input.PointsRequired,
		"discount_type":           normalizedLoyaltyDiscountType(input.DiscountType),
		"discount_amount_idr":     input.DiscountAmountIDR,
		"discount_percentage":     input.DiscountPercentage,
		"max_discount_amount_idr": input.MaxDiscountAmountIDR,
		"usage_limit":             input.UsageLimit,
		"per_customer_limit":      input.PerCustomerLimit,
		"starts_at":               input.StartsAt,
		"ends_at":                 input.EndsAt,
		"is_active":               isActive,
	}
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
		utils.RespondError(c, http.StatusConflict, "Hadiah tidak tersedia untuk pelanggan ini, belum berlaku, atau sudah dinonaktifkan.")
	case errors.Is(err, errLoyaltyRewardLimitReached):
		utils.RespondError(c, http.StatusConflict, "Batas penukaran hadiah sudah tercapai.")
	case errors.Is(err, errLoyaltyIdempotencyConflict):
		utils.RespondError(c, http.StatusConflict, "ID permintaan sudah digunakan untuk aksi loyalitas yang berbeda.")
	case errors.Is(err, errLoyaltyPointsLimit):
		utils.RespondError(c, http.StatusConflict, "Saldo poin akan melebihi batas yang didukung.")
	default:
		utils.RespondError(c, http.StatusInternalServerError, "Gagal memperbarui data loyalitas.")
	}
}
