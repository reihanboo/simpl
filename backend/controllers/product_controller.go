package controllers

import (
	"net/http"

	"backend/config"
	"backend/models"
	"backend/utils"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

func GetProducts(c *gin.Context) {
	branchIDStr := c.Param("id")
	branchID, err := uuid.Parse(branchIDStr)
	if err != nil {
		utils.RespondError(c, http.StatusBadRequest, "ID cabang tidak valid")
		return
	}

	// Fetch Branch to ensure it exists and get BusinessID
	var branch models.Branch
	if err := config.DB.First(&branch, "id = ?", branchID).Error; err != nil {
		utils.RespondError(c, http.StatusNotFound, "Cabang tidak ditemukan")
		return
	}

	// Fetch all BranchInventory for this branch and preload the Product
	var inventories []models.BranchInventory
	if err := config.DB.Preload("Product").Where("branch_id = ?", branchID).Find(&inventories).Error; err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Gagal mengambil data produk")
		return
	}

	// We can format the response nicely
	type ProductResponse struct {
		ID                uuid.UUID `json:"id"`
		ProductID         uuid.UUID `json:"product_id"`
		Name              string    `json:"name"`
		SKU               string    `json:"sku"`
		CostPriceIDR      int64     `json:"cost_price_idr"`
		SellingPriceIDR   int64     `json:"selling_price_idr"`
		LowStockThreshold int       `json:"low_stock_threshold"`
		CurrentStock      int       `json:"current_stock"`
		Status            string    `json:"status"`
	}

	var response []ProductResponse
	for _, inv := range inventories {
		status := "Aman"
		if inv.CurrentStock == 0 {
			status = "Habis"
		} else if inv.CurrentStock <= inv.Product.LowStockThreshold {
			status = "Menipis"
		}

		response = append(response, ProductResponse{
			ID:                inv.ID, // Inventory ID
			ProductID:         inv.Product.ID,
			Name:              inv.Product.Name,
			SKU:               inv.Product.SKU,
			CostPriceIDR:      inv.Product.CostPriceIDR,
			SellingPriceIDR:   inv.Product.SellingPriceIDR,
			LowStockThreshold: inv.Product.LowStockThreshold,
			CurrentStock:      inv.CurrentStock,
			Status:            status,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"data": response,
	})
}

type CreateProductInput struct {
	Name              string `json:"name" binding:"required"`
	SKU               string `json:"sku" binding:"required"`
	CostPriceIDR      int64  `json:"cost_price_idr" binding:"required"`
	SellingPriceIDR   int64  `json:"selling_price_idr" binding:"required"`
	LowStockThreshold int    `json:"low_stock_threshold"`
	InitialStock      int    `json:"initial_stock"`
}

func CreateProduct(c *gin.Context) {
	// Get user from context
	userIDValue, exists := c.Get("userID")
	if !exists {
		utils.RespondError(c, http.StatusUnauthorized, "Sesi tidak ditemukan")
		return
	}
	
	userID, ok := userIDValue.(uuid.UUID)
	if !ok {
		utils.RespondError(c, http.StatusUnauthorized, "Sesi tidak valid")
		return
	}

	// Get branch ID from URL parameter
	branchIDStr := c.Param("id")
	branchID, err := uuid.Parse(branchIDStr)
	if err != nil {
		utils.RespondError(c, http.StatusBadRequest, "ID cabang tidak valid")
		return
	}

	// Lookup branch to get business ID
	var branch models.Branch
	if err := config.DB.First(&branch, "id = ?", branchID).Error; err != nil {
		utils.RespondError(c, http.StatusNotFound, "Cabang tidak ditemukan")
		return
	}

	// Validate input
	var input CreateProductInput
	if err := c.ShouldBindJSON(&input); err != nil {
		utils.RespondError(c, http.StatusBadRequest, "Data input tidak valid: "+err.Error())
		return
	}

	// Start a transaction since we are creating multiple related records
	tx := config.DB.Begin()

	// 1. Create Product
	product := models.Product{
		BusinessID:        branch.BusinessID,
		Name:              input.Name,
		SKU:               input.SKU,
		CostPriceIDR:      input.CostPriceIDR,
		SellingPriceIDR:   input.SellingPriceIDR,
		LowStockThreshold: input.LowStockThreshold,
	}

	if err := tx.Create(&product).Error; err != nil {
		tx.Rollback()
		utils.RespondError(c, http.StatusInternalServerError, "Gagal membuat produk")
		return
	}

	// 2. Fetch all branches for this business
	var businessBranches []models.Branch
	if err := tx.Where("business_id = ?", branch.BusinessID).Find(&businessBranches).Error; err != nil {
		tx.Rollback()
		utils.RespondError(c, http.StatusInternalServerError, "Gagal memuat cabang untuk sinkronisasi inventori")
		return
	}

	// 3. Create BranchInventory for all branches
	for _, b := range businessBranches {
		stock := 0
		if b.ID == branch.ID {
			stock = input.InitialStock
		}

		branchInventory := models.BranchInventory{
			BranchID:     b.ID,
			ProductID:    product.ID,
			CurrentStock: stock,
		}

		if err := tx.Create(&branchInventory).Error; err != nil {
			tx.Rollback()
			utils.RespondError(c, http.StatusInternalServerError, "Gagal menambahkan inventori cabang")
			return
		}
	}

	// 4. Create StockMovement if InitialStock > 0 for the current branch
	if input.InitialStock > 0 {
		movement := models.StockMovement{
			BranchID:  branch.ID,
			ProductID: product.ID,
			UserID:    userID,
			QtyChange: input.InitialStock,
			Reason:    "adjustment", // Set as adjustment for initial stock setup
		}

		if err := tx.Create(&movement).Error; err != nil {
			tx.Rollback()
			utils.RespondError(c, http.StatusInternalServerError, "Gagal mencatat histori stok")
			return
		}
	}

	tx.Commit()

	c.JSON(http.StatusCreated, gin.H{
		"message": "Produk berhasil ditambahkan",
		"product": product,
	})
}

type StockMovementInput struct {
	QtyChange int    `json:"qty_change" binding:"required"`
	Reason    string `json:"reason" binding:"required"` // sale | restock | adjustment | return | po_receive
}

func AddStockMovement(c *gin.Context) {
	// Get user from context
	userIDValue, exists := c.Get("userID")
	if !exists {
		utils.RespondError(c, http.StatusUnauthorized, "Sesi tidak ditemukan")
		return
	}
	
	userID, ok := userIDValue.(uuid.UUID)
	if !ok {
		utils.RespondError(c, http.StatusUnauthorized, "Sesi tidak valid")
		return
	}

	// Get branch ID
	branchIDStr := c.Param("id")
	branchID, err := uuid.Parse(branchIDStr)
	if err != nil {
		utils.RespondError(c, http.StatusBadRequest, "ID cabang tidak valid")
		return
	}

	// Get product ID
	productIDStr := c.Param("product_id")
	productID, err := uuid.Parse(productIDStr)
	if err != nil {
		utils.RespondError(c, http.StatusBadRequest, "ID produk tidak valid")
		return
	}

	var input StockMovementInput
	if err := c.ShouldBindJSON(&input); err != nil {
		utils.RespondError(c, http.StatusBadRequest, "Data input tidak valid: "+err.Error())
		return
	}

	// Start transaction
	tx := config.DB.Begin()

	// Find the branch inventory record and lock it for update
	var branchInventory models.BranchInventory
	if err := tx.Where("branch_id = ? AND product_id = ?", branchID, productID).First(&branchInventory).Error; err != nil {
		tx.Rollback()
		utils.RespondError(c, http.StatusNotFound, "Inventori cabang untuk produk ini tidak ditemukan")
		return
	}

	// Update stock
	branchInventory.CurrentStock += input.QtyChange
	if branchInventory.CurrentStock < 0 {
		tx.Rollback()
		utils.RespondError(c, http.StatusBadRequest, "Stok tidak mencukupi")
		return
	}

	if err := tx.Save(&branchInventory).Error; err != nil {
		tx.Rollback()
		utils.RespondError(c, http.StatusInternalServerError, "Gagal memperbarui stok")
		return
	}

	// Create movement record
	movement := models.StockMovement{
		BranchID:  branchID,
		ProductID: productID,
		UserID:    userID,
		QtyChange: input.QtyChange,
		Reason:    input.Reason,
	}

	if err := tx.Create(&movement).Error; err != nil {
		tx.Rollback()
		utils.RespondError(c, http.StatusInternalServerError, "Gagal mencatat pergerakan stok")
		return
	}

	tx.Commit()

	c.JSON(http.StatusOK, gin.H{
		"message": "Pergerakan stok berhasil dicatat",
		"data":    movement,
		"current_stock": branchInventory.CurrentStock,
	})
}

func GetStockMovements(c *gin.Context) {
	// Get branch ID
	branchIDStr := c.Param("id")
	branchID, err := uuid.Parse(branchIDStr)
	if err != nil {
		utils.RespondError(c, http.StatusBadRequest, "ID cabang tidak valid")
		return
	}

	// Fetch movements for the branch
	var movements []models.StockMovement
	// Preload Product (unscoped to include deleted products) so we still see their names in history
	if err := config.DB.Preload("Product", func(db *gorm.DB) *gorm.DB {
		return db.Unscoped()
	}).Where("branch_id = ?", branchID).Order("created_at desc").Find(&movements).Error; err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Gagal memuat histori pergerakan stok")
		return
	}

	type MovementResponse struct {
		ID        uuid.UUID `json:"id"`
		Date      string    `json:"date"`
		SKU       string    `json:"sku"`
		Name      string    `json:"name"`
		Type      string    `json:"type"`
		Qty       int       `json:"qty"`
		Reason    string    `json:"reason"`
		User      string    `json:"user"` // just returning ID for now or hardcode if we don't join
	}

	var response []MovementResponse
	for _, m := range movements {
		movementType := "in"
		if m.QtyChange < 0 {
			if m.Reason == "sale" || m.Reason == "return" { // return to supplier
				movementType = "out"
			} else {
				movementType = "adj"
			}
		}

		response = append(response, MovementResponse{
			ID:     m.ID,
			Date:   m.CreatedAt.Format("02 Jan 2006, 15:04"),
			SKU:    m.Product.SKU,
			Name:   m.Product.Name,
			Type:   movementType,
			Qty:    m.QtyChange,
			Reason: m.Reason,
			User:   "Admin", // Can be joined with User table if needed later
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"data": response,
	})
}

func DeleteProduct(c *gin.Context) {
	// Get user from context
	_, exists := c.Get("userID")
	if !exists {
		utils.RespondError(c, http.StatusUnauthorized, "Sesi tidak ditemukan")
		return
	}

	productIDStr := c.Param("product_id")
	productID, err := uuid.Parse(productIDStr)
	if err != nil {
		utils.RespondError(c, http.StatusBadRequest, "ID produk tidak valid")
		return
	}

	tx := config.DB.Begin()

	// Delete branch inventories related to the product
	if err := tx.Where("product_id = ?", productID).Delete(&models.BranchInventory{}).Error; err != nil {
		tx.Rollback()
		utils.RespondError(c, http.StatusInternalServerError, "Gagal menghapus inventori cabang")
		return
	}

	// Soft delete the product itself
	if err := tx.Where("id = ?", productID).Delete(&models.Product{}).Error; err != nil {
		tx.Rollback()
		utils.RespondError(c, http.StatusInternalServerError, "Gagal menghapus produk")
		return
	}

	tx.Commit()

	c.JSON(http.StatusOK, gin.H{
		"message": "Produk berhasil dihapus",
	})
}
