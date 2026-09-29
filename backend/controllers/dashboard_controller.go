package controllers

import (
	"net/http"
	"strconv"
	"time"

	"backend/config"
	"backend/models"
	"backend/utils"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const defaultDashboardDays = 7

type dashboardSalesPoint struct {
	Date    string `json:"date"`
	Label   string `json:"label"`
	Revenue int64  `json:"revenue"`
	Orders  int    `json:"orders"`
}

type dashboardRecentOrder struct {
	ID             uuid.UUID `json:"id"`
	OrderNumber    string    `json:"order_number"`
	CreatedAt      time.Time `json:"created_at"`
	TotalAmountIDR int64     `json:"total_amount_idr"`
	ItemsCount     int       `json:"items_count"`
	PaymentMethod  string    `json:"payment_method"`
	PaymentStatus  string    `json:"payment_status"`
}

// GetBranchDashboard returns the branch overview: today's metrics, a daily sales
// series for the selected period, and the most recent orders.
func GetBranchDashboard(c *gin.Context) {
	branchID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		utils.RespondError(c, http.StatusBadRequest, "ID cabang tidak valid")
		return
	}

	var branch models.Branch
	if err := config.DB.First(&branch, "id = ?", branchID).Error; err != nil {
		utils.RespondError(c, http.StatusNotFound, "Cabang tidak ditemukan")
		return
	}

	days := defaultDashboardDays
	if raw := c.Query("days"); raw != "" {
		if n, parseErr := strconv.Atoi(raw); parseErr == nil && n > 0 && n <= 90 {
			days = n
		}
	}

	loc := time.FixedZone("WIB", 7*60*60)
	today := time.Now().In(loc)
	todayKey := today.Format("2006-01-02")
	yesterdayKey := today.AddDate(0, 0, -1).Format("2006-01-02")
	startKey := today.AddDate(0, 0, -(days - 1)).Format("2006-01-02")

	// Daily revenue/orders over the selected period.
	type dailyRow struct {
		SaleDate string
		Revenue  int64
		Orders   int
	}
	var dailyRows []dailyRow
	if err := config.DB.Raw(`
		SELECT to_char(o.created_at AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD') AS sale_date,
		       COALESCE(SUM(o.total_amount_idr), 0)::bigint AS revenue,
		       COUNT(*)::int AS orders
		FROM orders o
		WHERE o.branch_id = ?
		  AND o.payment_status <> 'refunded'
		  AND (o.created_at AT TIME ZONE 'Asia/Jakarta')::date >= ?::date
		GROUP BY sale_date
	`, branchID, startKey).Scan(&dailyRows).Error; err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Gagal menghitung data penjualan")
		return
	}

	byDate := make(map[string]dailyRow, len(dailyRows))
	for _, row := range dailyRows {
		byDate[row.SaleDate] = row
	}

	base := today.AddDate(0, 0, -(days - 1))
	series := make([]dashboardSalesPoint, 0, days)
	for i := 0; i < days; i++ {
		d := base.AddDate(0, 0, i)
		key := d.Format("2006-01-02")
		row := byDate[key]
		series = append(series, dashboardSalesPoint{
			Date:    key,
			Label:   d.Format("02 Jan"),
			Revenue: row.Revenue,
			Orders:  row.Orders,
		})
	}

	// Today vs yesterday totals for the metric cards.
	type dayTotals struct {
		Revenue int64
		Orders  int
		Items   int
	}
	totals := map[string]*dayTotals{todayKey: {}, yesterdayKey: {}}

	var revenueRows []dailyRow
	config.DB.Raw(`
		SELECT to_char(o.created_at AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD') AS sale_date,
		       COALESCE(SUM(o.total_amount_idr), 0)::bigint AS revenue,
		       COUNT(*)::int AS orders
		FROM orders o
		WHERE o.branch_id = ?
		  AND o.payment_status <> 'refunded'
		  AND (o.created_at AT TIME ZONE 'Asia/Jakarta')::date IN (?::date, ?::date)
		GROUP BY sale_date
	`, branchID, todayKey, yesterdayKey).Scan(&revenueRows)
	for _, row := range revenueRows {
		if t, ok := totals[row.SaleDate]; ok {
			t.Revenue = row.Revenue
			t.Orders = row.Orders
		}
	}

	type itemRow struct {
		SaleDate string
		Items    int
	}
	var itemRows []itemRow
	config.DB.Raw(`
		SELECT to_char(o.created_at AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD') AS sale_date,
		       COALESCE(SUM(oi.qty), 0)::int AS items
		FROM order_items oi
		JOIN orders o ON o.id = oi.order_id
		WHERE o.branch_id = ?
		  AND o.payment_status <> 'refunded'
		  AND (o.created_at AT TIME ZONE 'Asia/Jakarta')::date IN (?::date, ?::date)
		GROUP BY sale_date
	`, branchID, todayKey, yesterdayKey).Scan(&itemRows)
	for _, row := range itemRows {
		if t, ok := totals[row.SaleDate]; ok {
			t.Items = row.Items
		}
	}

	// Inventory health.
	var inventories []models.BranchInventory
	config.DB.Preload("Product").Where("branch_id = ?", branchID).Find(&inventories)
	var productsTotal, lowStockCount, outOfStockCount int
	for _, inv := range inventories {
		if inv.Product.ID == uuid.Nil {
			continue
		}
		productsTotal++
		if inv.CurrentStock <= 0 {
			outOfStockCount++
		} else if inv.CurrentStock <= inv.Product.LowStockThreshold {
			lowStockCount++
		}
	}

	// Recent orders.
	var recent []models.Order
	config.DB.Preload("Items").Where("branch_id = ?", branchID).Order("created_at desc").Limit(6).Find(&recent)
	recentResponse := make([]dashboardRecentOrder, 0, len(recent))
	for _, o := range recent {
		recentResponse = append(recentResponse, dashboardRecentOrder{
			ID:             o.ID,
			OrderNumber:    o.OrderNumber,
			CreatedAt:      o.CreatedAt,
			TotalAmountIDR: o.TotalAmountIDR,
			ItemsCount:     len(o.Items),
			PaymentMethod:  o.PaymentMethod,
			PaymentStatus:  o.PaymentStatus,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"branch": gin.H{
			"id":      branch.ID,
			"name":    branch.Name,
			"address": branch.Address,
		},
		"period_days": days,
		"metrics": gin.H{
			"revenue_today":        totals[todayKey].Revenue,
			"revenue_yesterday":    totals[yesterdayKey].Revenue,
			"orders_today":         totals[todayKey].Orders,
			"orders_yesterday":     totals[yesterdayKey].Orders,
			"items_sold_today":     totals[todayKey].Items,
			"items_sold_yesterday": totals[yesterdayKey].Items,
			"customers_total":      0, // no customer module yet
			"low_stock_count":      lowStockCount,
			"out_of_stock_count":   outOfStockCount,
			"products_total":       productsTotal,
		},
		"sales_series":  series,
		"recent_orders": recentResponse,
	})
}
