package controllers

import (
	"fmt"
	"net/http"
	"time"

	"backend/config"
	"backend/models"
	"backend/utils"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type OrderItemInput struct {
	ProductID uuid.UUID `json:"product_id" binding:"required"`
	Qty       int       `json:"qty" binding:"required"`
}

type CreateOrderInput struct {
	Items         []OrderItemInput `json:"items" binding:"required,min=1"`
	PaymentMethod string           `json:"payment_method" binding:"required"`
}

func CreateOrder(c *gin.Context) {
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

	// Lookup branch to get business ID
	var branch models.Branch
	if err := config.DB.First(&branch, "id = ?", branchID).Error; err != nil {
		utils.RespondError(c, http.StatusNotFound, "Cabang tidak ditemukan")
		return
	}

	var input CreateOrderInput
	if err := c.ShouldBindJSON(&input); err != nil {
		utils.RespondError(c, http.StatusBadRequest, "Data input tidak valid: "+err.Error())
		return
	}

	tx := config.DB.Begin()

	// 1. Create the base Order record
	orderNumber := fmt.Sprintf("ORD-%d", time.Now().Unix())
	order := models.Order{
		BusinessID:        branch.BusinessID,
		BranchID:          branch.ID,
		CashierID:         userID,
		OrderNumber:       orderNumber,
		TotalAmountIDR:    0,
		DiscountAmountIDR: 0,
		PaymentMethod:     input.PaymentMethod,
		PaymentStatus:     "paid",
	}

	if err := tx.Create(&order).Error; err != nil {
		tx.Rollback()
		utils.RespondError(c, http.StatusInternalServerError, "Gagal membuat transaksi")
		return
	}

	var totalAmount int64 = 0

	// 2. Process each item
	for _, itemInput := range input.Items {
		// Fetch product to get selling price
		var product models.Product
		if err := tx.Where("id = ?", itemInput.ProductID).First(&product).Error; err != nil {
			tx.Rollback()
			utils.RespondError(c, http.StatusNotFound, "Produk tidak ditemukan: "+itemInput.ProductID.String())
			return
		}

		subtotal := product.SellingPriceIDR * int64(itemInput.Qty)
		totalAmount += subtotal

		// Create order item
		orderItem := models.OrderItem{
			OrderID:      order.ID,
			ProductID:    product.ID,
			Qty:          itemInput.Qty,
			UnitPriceIDR: product.SellingPriceIDR,
			SubtotalIDR:  subtotal,
		}
		if err := tx.Create(&orderItem).Error; err != nil {
			tx.Rollback()
			utils.RespondError(c, http.StatusInternalServerError, "Gagal mencatat item transaksi")
			return
		}

		// Decrease inventory
		var branchInventory models.BranchInventory
		if err := tx.Where("branch_id = ? AND product_id = ?", branch.ID, product.ID).First(&branchInventory).Error; err != nil {
			tx.Rollback()
			utils.RespondError(c, http.StatusInternalServerError, "Gagal mendapatkan stok produk")
			return
		}

		branchInventory.CurrentStock -= itemInput.Qty
		if err := tx.Save(&branchInventory).Error; err != nil {
			tx.Rollback()
			utils.RespondError(c, http.StatusInternalServerError, "Gagal memperbarui stok produk")
			return
		}

		// Record stock movement
		movement := models.StockMovement{
			BranchID:  branch.ID,
			ProductID: product.ID,
			UserID:    userID,
			QtyChange: -itemInput.Qty,
			Reason:    "sale",
		}
		if err := tx.Create(&movement).Error; err != nil {
			tx.Rollback()
			utils.RespondError(c, http.StatusInternalServerError, "Gagal mencatat histori stok")
			return
		}
	}

	// Update total amount on the order
	order.TotalAmountIDR = totalAmount
	if err := tx.Save(&order).Error; err != nil {
		tx.Rollback()
		utils.RespondError(c, http.StatusInternalServerError, "Gagal memperbarui total transaksi")
		return
	}

	tx.Commit()

	c.JSON(http.StatusCreated, gin.H{
		"message": "Transaksi berhasil diproses",
		"order":   order,
	})
}
