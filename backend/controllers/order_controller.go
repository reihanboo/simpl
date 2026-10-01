package controllers

import (
	"errors"
	"fmt"
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

type OrderItemInput struct {
	ProductID uuid.UUID `json:"product_id" binding:"required"`
	Qty       int       `json:"qty" binding:"required"`
}

type CreateOrderInput struct {
	Items         []OrderItemInput `json:"items" binding:"required,min=1"`
	PaymentMethod string           `json:"payment_method" binding:"required"`
	CustomerID    *uuid.UUID       `json:"customer_id"`
	VoucherID     *uuid.UUID       `json:"voucher_id"`
}

var supportedPaymentMethods = map[string]struct{}{
	"cash": {}, "qris": {}, "debit": {}, "credit": {}, "transfer": {}, "ewallet": {},
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
	input.PaymentMethod = strings.ToLower(strings.TrimSpace(input.PaymentMethod))
	if _, ok := supportedPaymentMethods[input.PaymentMethod]; !ok {
		utils.RespondError(c, http.StatusBadRequest, "Metode pembayaran tidak didukung")
		return
	}
	if input.VoucherID != nil && input.CustomerID == nil {
		utils.RespondError(c, http.StatusBadRequest, "Pilih pelanggan untuk menggunakan voucher.")
		return
	}

	tx := config.DB.Begin()
	if tx.Error != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Gagal memulai transaksi")
		return
	}

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
		CustomerID:        input.CustomerID,
		LoyaltyVoucherID:  input.VoucherID,
	}

	if input.CustomerID != nil {
		var customer models.Customer
		if err := tx.Where("id = ? AND business_id = ?", *input.CustomerID, branch.BusinessID).First(&customer).Error; err != nil {
			tx.Rollback()
			if errors.Is(err, gorm.ErrRecordNotFound) {
				utils.RespondError(c, http.StatusNotFound, "Pelanggan tidak ditemukan pada bisnis ini.")
			} else {
				utils.RespondError(c, http.StatusInternalServerError, "Gagal memverifikasi pelanggan.")
			}
			return
		}
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

	var appliedVoucher models.LoyaltyVoucher
	if input.VoucherID != nil {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ? AND business_id = ? AND customer_id = ? AND used_at IS NULL", *input.VoucherID, branch.BusinessID, *input.CustomerID).
			First(&appliedVoucher).Error; err != nil {
			tx.Rollback()
			if errors.Is(err, gorm.ErrRecordNotFound) {
				utils.RespondError(c, http.StatusConflict, "Voucher tidak tersedia untuk pelanggan ini atau sudah digunakan.")
			} else {
				utils.RespondError(c, http.StatusInternalServerError, "Gagal memverifikasi voucher pelanggan.")
			}
			return
		}
		discount, err := calculateVoucherDiscount(totalAmount, appliedVoucher.DiscountType, appliedVoucher.DiscountAmountIDR, appliedVoucher.DiscountPercentage, appliedVoucher.MaxDiscountAmountIDR)
		if err != nil {
			tx.Rollback()
			utils.RespondError(c, http.StatusConflict, "Voucher pelanggan memiliki aturan diskon yang tidak valid.")
			return
		}
		order.DiscountAmountIDR = discount
	}
	order.TotalAmountIDR = totalAmount - order.DiscountAmountIDR
	if err := tx.Save(&order).Error; err != nil {
		tx.Rollback()
		utils.RespondError(c, http.StatusInternalServerError, "Gagal memperbarui total transaksi")
		return
	}

	if input.VoucherID != nil {
		usedAt := time.Now()
		result := tx.Model(&models.LoyaltyVoucher{}).
			Where("id = ? AND used_at IS NULL", appliedVoucher.ID).
			Updates(map[string]interface{}{"used_at": usedAt, "order_id": order.ID})
		if result.Error != nil {
			tx.Rollback()
			utils.RespondError(c, http.StatusInternalServerError, "Gagal menandai voucher sebagai digunakan.")
			return
		}
		if result.RowsAffected == 0 {
			tx.Rollback()
			utils.RespondError(c, http.StatusConflict, "Voucher ini sudah digunakan.")
			return
		}
	}

	loyaltyPointsEarned := 0
	if input.CustomerID != nil {
		var customer models.Customer
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ? AND business_id = ?", *input.CustomerID, branch.BusinessID).First(&customer).Error; err != nil {
			tx.Rollback()
			if errors.Is(err, gorm.ErrRecordNotFound) {
				utils.RespondError(c, http.StatusNotFound, "Pelanggan tidak ditemukan pada bisnis ini.")
			} else {
				utils.RespondError(c, http.StatusInternalServerError, "Gagal memverifikasi pelanggan.")
			}
			return
		}

		if customer.MembershipActive {
			var business models.Business
			if err := tx.Select("id", "loyalty_rupiah_per_point").First(&business, "id = ?", branch.BusinessID).Error; err != nil {
				tx.Rollback()
				utils.RespondError(c, http.StatusInternalServerError, "Gagal mengambil pengaturan poin loyalitas.")
				return
			}
			loyaltyPointsEarned, err = calculateEarnedLoyaltyPoints(order.TotalAmountIDR, business.LoyaltyRupiahPerPoint)
			if err != nil {
				tx.Rollback()
				utils.RespondError(c, http.StatusConflict, "Jumlah poin transaksi melebihi batas yang didukung.")
				return
			}
			if loyaltyPointsEarned > 0 {
				newBalance, err := calculateLoyaltyBalance(customer.LoyaltyPoints, loyaltyPointsEarned)
				if err != nil {
					tx.Rollback()
					utils.RespondError(c, http.StatusConflict, "Saldo poin pelanggan akan melebihi batas yang didukung.")
					return
				}
				if err := tx.Model(&customer).Update("loyalty_points", newBalance).Error; err != nil {
					tx.Rollback()
					utils.RespondError(c, http.StatusInternalServerError, "Gagal memperbarui saldo poin pelanggan.")
					return
				}
				businessID := branch.BusinessID
				orderID := order.ID
				balanceAfter := newBalance
				entry := models.LoyaltyPointLog{
					BusinessID:         &businessID,
					CustomerID:         customer.ID,
					OrderID:            &orderID,
					PointsChanged:      loyaltyPointsEarned,
					PointsBalanceAfter: &balanceAfter,
					Reason:             "Poin dari transaksi " + order.OrderNumber,
					Type:               "earned",
					RequestID:          &orderID,
				}
				if err := tx.Create(&entry).Error; err != nil {
					tx.Rollback()
					utils.RespondError(c, http.StatusInternalServerError, "Gagal mencatat perolehan poin pelanggan.")
					return
				}
			}
		}
	}

	if err := tx.Commit().Error; err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Gagal menyelesaikan transaksi.")
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message":               "Transaksi berhasil diproses",
		"order":                 order,
		"loyalty_points_earned": loyaltyPointsEarned,
	})
}
