package controllers

import (
	"backend/config"
	"backend/models"
	"backend/utils"
	"net/http"

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
		BusinessID string `json:"business_id" binding:"required"`
		Name       string `json:"name" binding:"required"`
		Address    string `json:"address"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		utils.RespondError(c, http.StatusBadRequest, "Data yang diberikan tidak valid.")
		return
	}

	// Optionally we could verify if the user is a member/owner of the business.
	// For simplicity in this step, we just parse the BusinessID.
	
	businessUUID, err := uuid.Parse(input.BusinessID)
	if err != nil {
		utils.RespondError(c, http.StatusBadRequest, "ID Bisnis tidak valid.")
		return
	}

	// Start a transaction since we are creating a branch and its inventory links
	tx := config.DB.Begin()

	branch := models.Branch{
		BusinessID: businessUUID,
		Name:       input.Name,
		Address:    input.Address,
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
		"branch": branch,
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
		Name    string `json:"name" binding:"required"`
		Address string `json:"address"`
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

	if err := config.DB.Save(&branch).Error; err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Gagal memperbarui cabang.")
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"branch": branch,
		"message": "Cabang berhasil diperbarui",
	})
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
