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

type loyaltyRewardInput struct {
	Name              string `json:"name" binding:"required,max=255"`
	PointsRequired    int    `json:"points_required" binding:"required,min=1"`
	DiscountAmountIDR int64  `json:"discount_amount_idr" binding:"required,min=1"`
	IsActive          bool   `json:"is_active"`
}

type loyaltyPointsInput struct {
	PointsChange int `json:"points_change" binding:"required"`
}

var errInsufficientLoyaltyPoints = errors.New("insufficient loyalty points")
var errLoyaltyMembershipInactive = errors.New("loyalty membership inactive")

func GetLoyaltyRewards(c *gin.Context) {
	businessID, ok := getAuthorizedEnterpriseBusiness(c)
	if !ok {
		return
	}

	var rewards []models.LoyaltyReward
	if err := config.DB.Where("business_id = ?", businessID).Order("points_required ASC, created_at ASC").Find(&rewards).Error; err != nil {
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
	input.Name = strings.TrimSpace(input.Name)
	if input.Name == "" || input.PointsRequired < 1 || input.DiscountAmountIDR < 1 {
		utils.RespondError(c, http.StatusBadRequest, "Nama, poin, dan nominal diskon hadiah harus valid.")
		return
	}

	reward := models.LoyaltyReward{
		BusinessID:        businessID,
		Name:              input.Name,
		PointsRequired:    input.PointsRequired,
		DiscountAmountIDR: input.DiscountAmountIDR,
		IsActive:          input.IsActive,
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
	input.Name = strings.TrimSpace(input.Name)
	if input.Name == "" || input.PointsRequired < 1 || input.DiscountAmountIDR < 1 {
		utils.RespondError(c, http.StatusBadRequest, "Nama, poin, dan nominal diskon hadiah harus valid.")
		return
	}

	result := config.DB.Model(&models.LoyaltyReward{}).
		Where("id = ? AND business_id = ?", rewardID, businessID).
		Updates(map[string]interface{}{
			"name":                input.Name,
			"points_required":     input.PointsRequired,
			"discount_amount_idr": input.DiscountAmountIDR,
			"is_active":           input.IsActive,
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
	result := config.DB.Where("id = ? AND business_id = ?", rewardID, businessID).Delete(&models.LoyaltyReward{})
	if result.Error != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Gagal menghapus hadiah loyalitas.")
		return
	}
	if result.RowsAffected == 0 {
		utils.RespondError(c, http.StatusNotFound, "Hadiah loyalitas tidak ditemukan.")
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Hadiah loyalitas berhasil dihapus."})
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

	var input loyaltyPointsInput
	if err := c.ShouldBindJSON(&input); err != nil {
		utils.RespondBindError(c, err)
		return
	}
	if input.PointsChange == 0 || input.PointsChange > 1_000_000_000 || input.PointsChange < -1_000_000_000 {
		utils.RespondError(c, http.StatusBadRequest, "Perubahan poin harus antara -1.000.000.000 sampai 1.000.000.000 dan tidak boleh nol.")
		return
	}

	err := config.DB.Transaction(func(tx *gorm.DB) error {
		var customer models.Customer
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ? AND business_id = ?", customerID, businessID).First(&customer).Error; err != nil {
			return err
		}
		if !customer.MembershipActive {
			return errLoyaltyMembershipInactive
		}
		if customer.LoyaltyPoints+input.PointsChange < 0 {
			return errInsufficientLoyaltyPoints
		}

		customer.LoyaltyPoints += input.PointsChange
		if err := tx.Model(&customer).Update("loyalty_points", customer.LoyaltyPoints).Error; err != nil {
			return err
		}
		entryType := "earned"
		if input.PointsChange < 0 {
			entryType = "redeemed"
		}
		return tx.Create(&models.LoyaltyPointLog{
			CustomerID:    customerID,
			PointsChanged: input.PointsChange,
			Type:          entryType,
		}).Error
	})
	if err != nil {
		switch {
		case errors.Is(err, gorm.ErrRecordNotFound):
			utils.RespondError(c, http.StatusNotFound, "Pelanggan tidak ditemukan.")
		case errors.Is(err, errInsufficientLoyaltyPoints):
			utils.RespondError(c, http.StatusBadRequest, "Poin pelanggan tidak boleh kurang dari nol.")
		case errors.Is(err, errLoyaltyMembershipInactive):
			utils.RespondError(c, http.StatusBadRequest, "Pelanggan belum bergabung dengan program loyalitas.")
		default:
			utils.RespondError(c, http.StatusInternalServerError, "Gagal memperbarui poin pelanggan.")
		}
		return
	}

	var customer models.Customer
	if err := config.DB.Where("id = ? AND business_id = ?", customerID, businessID).First(&customer).Error; err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Gagal mengambil poin pelanggan.")
		return
	}
	c.JSON(http.StatusOK, gin.H{"customer": customer})
}
