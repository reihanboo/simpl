package controllers

import (
	"backend/config"
	"backend/models"
	"backend/utils"
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func GetBranches(c *gin.Context) {
	businessID := c.Query("business_id")
	if businessID == "" {
		utils.RespondError(c, http.StatusBadRequest, "business_id diperlukan.")
		return
	}

	var branches []models.Branch
	if err := config.DB.Where("business_id = ?", businessID).Find(&branches).Error; err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Gagal mengambil data cabang.")
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"branches": branches,
	})
}

func CreateBranch(c *gin.Context) {
	var input struct {
		BusinessID      string   `json:"business_id" binding:"required"`
		Name            string   `json:"name" binding:"required"`
		Address         string   `json:"address"`
		Latitude        *float64 `json:"latitude"`
		Longitude       *float64 `json:"longitude"`
		GeofenceRadiusM *int     `json:"geofence_radius_m"`
		Timezone        string   `json:"timezone"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		utils.RespondError(c, http.StatusBadRequest, "Data yang diberikan tidak valid.")
		return
	}

	businessUUID, err := uuid.Parse(input.BusinessID)
	if err != nil {
		utils.RespondError(c, http.StatusBadRequest, "ID Bisnis tidak valid.")
		return
	}

	// Create the branch and its inventory links in one transaction.
	tx := config.DB.Begin()

	branch := models.Branch{
		BusinessID: businessUUID,
		Name:       input.Name,
		Address:    input.Address,
	}
	if err := applyBranchTimezone(&branch, input.Timezone, true); err != nil {
		tx.Rollback()
		utils.RespondError(c, http.StatusBadRequest, err.Error())
		return
	}
	if err := applyBranchLocation(&branch, input.Latitude, input.Longitude, input.GeofenceRadiusM, true); err != nil {
		tx.Rollback()
		utils.RespondError(c, http.StatusBadRequest, err.Error())
		return
	}

	if err := tx.Create(&branch).Error; err != nil {
		tx.Rollback()
		utils.RespondError(c, http.StatusInternalServerError, "Gagal membuat cabang.")
		return
	}

	// Fetch all existing products for this business
	var products []models.Product
	if err := tx.Where("business_id = ?", businessUUID).Find(&products).Error; err != nil {
		tx.Rollback()
		utils.RespondError(c, http.StatusInternalServerError, "Gagal memuat katalog produk.")
		return
	}

	// Create BranchInventory (0 stock) for each product for this new branch
	for _, p := range products {
		inv := models.BranchInventory{
			BranchID:     branch.ID,
			ProductID:    p.ID,
			CurrentStock: 0,
		}
		if err := tx.Create(&inv).Error; err != nil {
			tx.Rollback()
			utils.RespondError(c, http.StatusInternalServerError, "Gagal sinkronisasi inventori cabang baru.")
			return
		}
	}

	tx.Commit()

	c.JSON(http.StatusCreated, gin.H{
		"branch":  branch,
		"message": "Cabang berhasil dibuat",
	})
}

func UpdateBranch(c *gin.Context) {
	branchID := c.Param("id")
	if branchID == "" {
		utils.RespondError(c, http.StatusBadRequest, "ID cabang diperlukan.")
		return
	}

	var input struct {
		Name            string   `json:"name" binding:"required"`
		Address         string   `json:"address"`
		Latitude        *float64 `json:"latitude"`
		Longitude       *float64 `json:"longitude"`
		GeofenceRadiusM *int     `json:"geofence_radius_m"`
		Timezone        string   `json:"timezone"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		utils.RespondError(c, http.StatusBadRequest, "Data yang diberikan tidak valid.")
		return
	}

	var branch models.Branch
	if err := config.DB.Where("id = ?", branchID).First(&branch).Error; err != nil {
		utils.RespondError(c, http.StatusNotFound, "Cabang tidak ditemukan.")
		return
	}

	branch.Name = input.Name
	branch.Address = input.Address
	if err := applyBranchTimezone(&branch, input.Timezone, false); err != nil {
		utils.RespondError(c, http.StatusBadRequest, err.Error())
		return
	}
	if err := applyBranchLocation(&branch, input.Latitude, input.Longitude, input.GeofenceRadiusM, false); err != nil {
		utils.RespondError(c, http.StatusBadRequest, err.Error())
		return
	}

	if err := config.DB.Save(&branch).Error; err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Gagal memperbarui cabang.")
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"branch":  branch,
		"message": "Cabang berhasil diperbarui",
	})
}

func applyBranchTimezone(branch *models.Branch, timezone string, isCreate bool) error {
	timezone = strings.TrimSpace(timezone)
	if timezone == "" {
		if isCreate || branch.Timezone == "" {
			branch.Timezone = utils.DefaultTimezone
		}
		return nil
	}
	if _, err := utils.LoadTimezone(timezone); err != nil {
		return fmt.Errorf("Zona waktu cabang tidak valid.")
	}
	branch.Timezone = timezone
	return nil
}

func applyBranchLocation(branch *models.Branch, latitude, longitude *float64, radius *int, isCreate bool) error {
	if (latitude == nil) != (longitude == nil) {
		return fmt.Errorf("latitude dan longitude harus diisi bersamaan.")
	}
	if latitude != nil {
		if *latitude < -90 || *latitude > 90 || *longitude < -180 || *longitude > 180 {
			return fmt.Errorf("Koordinat lokasi cabang tidak valid.")
		}
		branch.Latitude = latitude
		branch.Longitude = longitude
	}
	if radius != nil {
		if *radius < 10 || *radius > 5000 {
			return fmt.Errorf("Radius geofence harus antara 10 dan 5000 meter.")
		}
		branch.GeofenceRadiusM = *radius
	} else if isCreate && branch.GeofenceRadiusM == 0 {
		branch.GeofenceRadiusM = 100
	}
	return nil
}

func DeleteBranch(c *gin.Context) {
	branchID := c.Param("id")
	if branchID == "" {
		utils.RespondError(c, http.StatusBadRequest, "ID cabang diperlukan.")
		return
	}

	var branch models.Branch
	if err := config.DB.Where("id = ?", branchID).First(&branch).Error; err != nil {
		utils.RespondError(c, http.StatusNotFound, "Cabang tidak ditemukan.")
		return
	}

	if err := config.DB.Delete(&branch).Error; err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Gagal menghapus cabang.")
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Cabang berhasil dihapus",
	})
}
