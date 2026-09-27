package controllers

import (
	"net/http"
	"time"

	"backend/config"
	"backend/models"
	"backend/utils"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// GetSalesReport returns all orders for a branch, with optional date range filtering.
// Query params: start_date, end_date (format: YYYY-MM-DD)
func GetSalesReport(c *gin.Context) {
	branchIDStr := c.Param("id")
	branchID, err := uuid.Parse(branchIDStr)
	if err != nil {
		utils.RespondError(c, http.StatusBadRequest, "ID cabang tidak valid")
		return
	}

	// Verify branch exists
	var branch models.Branch
	if err := config.DB.First(&branch, "id = ?", branchID).Error; err != nil {
		utils.RespondError(c, http.StatusNotFound, "Cabang tidak ditemukan")
		return
	}

	// Parse optional date range
	startDateStr := c.Query("start_date")
	endDateStr := c.Query("end_date")

	query := config.DB.Where("branch_id = ?", branchID).
		Preload("Items").
		Preload("Items.Product").
		Order("created_at DESC")

	if startDateStr != "" {
		if startDate, err := time.Parse("2006-01-02", startDateStr); err == nil {
			query = query.Where("created_at >= ?", startDate)
		}
	}

	if endDateStr != "" {
		if endDate, err := time.Parse("2006-01-02", endDateStr); err == nil {
			// Add 1 day to include the full end date
			query = query.Where("created_at < ?", endDate.Add(24*time.Hour))
		}
	}

	var orders []models.Order
	if err := query.Find(&orders).Error; err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Gagal mengambil data laporan penjualan")
		return
	}

	// Calculate summary stats
	var totalRevenue int64
	var totalDiscount int64
	var totalOrders int = len(orders)
	var totalItemsSold int

	for _, order := range orders {
		totalRevenue += order.TotalAmountIDR
		totalDiscount += order.DiscountAmountIDR
		totalItemsSold += len(order.Items)
	}

	c.JSON(http.StatusOK, gin.H{
		"orders": orders,
		"summary": gin.H{
			"total_orders":     totalOrders,
			"total_revenue":    totalRevenue,
			"total_discount":   totalDiscount,
			"total_items_sold": totalItemsSold,
		},
	})
}

// GetInventoryReport returns a snapshot of all inventory for a branch
// including cost/value calculations.
func GetInventoryReport(c *gin.Context) {
	branchIDStr := c.Param("id")
	branchID, err := uuid.Parse(branchIDStr)
	if err != nil {
		utils.RespondError(c, http.StatusBadRequest, "ID cabang tidak valid")
		return
	}

	var branch models.Branch
	if err := config.DB.First(&branch, "id = ?", branchID).Error; err != nil {
		utils.RespondError(c, http.StatusNotFound, "Cabang tidak ditemukan")
		return
	}

	type InventoryReportItem struct {
		ProductID         uuid.UUID `json:"product_id"`
		ProductName       string    `json:"product_name"`
		SKU               string    `json:"sku"`
		CurrentStock      int       `json:"current_stock"`
		CostPriceIDR      int64     `json:"cost_price_idr"`
		SellingPriceIDR   int64     `json:"selling_price_idr"`
		StockValueCost    int64     `json:"stock_value_cost"`
		StockValueSelling int64     `json:"stock_value_selling"`
		LowStockThreshold int       `json:"low_stock_threshold"`
		Status            string    `json:"status"`
	}

	var inventories []models.BranchInventory
	if err := config.DB.Where("branch_id = ?", branchID).
		Preload("Product").
		Find(&inventories).Error; err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Gagal mengambil data inventori")
		return
	}

	var items []InventoryReportItem
	var totalStockValueCost int64
	var totalStockValueSelling int64
	var totalProducts int
	var lowStockCount int
	var outOfStockCount int

	for _, inv := range inventories {
		if inv.Product.ID == uuid.Nil {
			continue
		}

		valueCost := inv.Product.CostPriceIDR * int64(inv.CurrentStock)
		valueSelling := inv.Product.SellingPriceIDR * int64(inv.CurrentStock)

		status := "Aman"
		if inv.CurrentStock <= 0 {
			status = "Habis"
			outOfStockCount++
		} else if inv.CurrentStock <= inv.Product.LowStockThreshold {
			status = "Menipis"
			lowStockCount++
		}

		items = append(items, InventoryReportItem{
			ProductID:         inv.Product.ID,
			ProductName:       inv.Product.Name,
			SKU:               inv.Product.SKU,
			CurrentStock:      inv.CurrentStock,
			CostPriceIDR:      inv.Product.CostPriceIDR,
			SellingPriceIDR:   inv.Product.SellingPriceIDR,
			StockValueCost:    valueCost,
			StockValueSelling: valueSelling,
			LowStockThreshold: inv.Product.LowStockThreshold,
			Status:            status,
		})

		totalStockValueCost += valueCost
		totalStockValueSelling += valueSelling
		totalProducts++
	}

	c.JSON(http.StatusOK, gin.H{
		"items": items,
		"summary": gin.H{
			"total_products":           totalProducts,
			"total_stock_value_cost":   totalStockValueCost,
			"total_stock_value_selling": totalStockValueSelling,
			"low_stock_count":          lowStockCount,
			"out_of_stock_count":       outOfStockCount,
		},
	})
}
