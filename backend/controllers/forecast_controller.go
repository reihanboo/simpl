package controllers

import (
	"math"
	"net/http"
	"sort"
	"strconv"
	"time"

	"backend/config"
	"backend/models"
	"backend/utils"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const (
	defaultForecastDays     = 14
	defaultForecastLookback = 30
	forecastServiceLevelZ   = 1.65 // approx. 95% service level
	forecastEMAAlpha        = 0.3
	forecastSMAWindow       = 7
)

type stockForecastItem struct {
	ProductID             uuid.UUID `json:"product_id"`
	Name                  string    `json:"name"`
	SKU                   string    `json:"sku"`
	CurrentStock          int       `json:"current_stock"`
	LowStockThreshold     int       `json:"low_stock_threshold"`
	CostPriceIDR          int64     `json:"cost_price_idr"`
	SellingPriceIDR       int64     `json:"selling_price_idr"`
	AvgDailyDemand        float64   `json:"avg_daily_demand"`
	StdDevDailyDemand     float64   `json:"stddev_daily_demand"`
	SmoothedDailyDemand   float64   `json:"smoothed_daily_demand"`
	PredictedDemand       int       `json:"predicted_demand"`
	SafetyStock           int       `json:"safety_stock"`
	ReorderPoint          int       `json:"reorder_point"`
	RecommendedReorderQty int       `json:"recommended_reorder_qty"`
	DaysOfCover           *float64  `json:"days_of_cover"`
	EstimatedStockoutDate *string   `json:"estimated_stockout_date"`
	Priority              string    `json:"priority"`
}

func roundToHundredths(v float64) float64 {
	return math.Round(v*100) / 100
}

func parseBoundedQuery(c *gin.Context, key string, fallback, min, max int) int {
	raw := c.Query(key)
	if raw == "" {
		return fallback
	}
	n, err := strconv.Atoi(raw)
	if err != nil {
		return fallback
	}
	if n < min {
		return min
	}
	if n > max {
		return max
	}
	return n
}

// GetStockForecast forecasts branch inventory demand using Welford's online
// algorithm (running mean and standard deviation of daily demand) combined with
// a smoothing method (EMA or SMA). Query params: days (horizon), lookback,
// algorithm (ema|sma).
func GetStockForecast(c *gin.Context) {
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

	horizonDays := parseBoundedQuery(c, "days", defaultForecastDays, 1, 180)
	lookbackDays := parseBoundedQuery(c, "lookback", defaultForecastLookback, 1, 365)
	algorithm := c.DefaultQuery("algorithm", "ema")
	if algorithm != "sma" {
		algorithm = "ema"
	}

	loc := time.FixedZone("WIB", 7*60*60)
	today := time.Now().In(loc)
	start := today.AddDate(0, 0, -(lookbackDays - 1))
	startDate := time.Date(start.Year(), start.Month(), start.Day(), 0, 0, 0, 0, time.UTC)

	// Aggregate historical sales into daily buckets per product. Days without
	// sales are represented as zero demand when the series is built below.
	type dailySaleRow struct {
		ProductID string
		SaleDate  string
		Qty       int
	}
	var rows []dailySaleRow
	if err := config.DB.Raw(`
		SELECT oi.product_id::text AS product_id,
		       to_char(o.created_at AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD') AS sale_date,
		       COALESCE(SUM(oi.qty), 0)::int AS qty
		FROM order_items oi
		JOIN orders o ON o.id = oi.order_id
		WHERE o.branch_id = ?
		  AND o.payment_status <> 'refunded'
		  AND (o.created_at AT TIME ZONE 'Asia/Jakarta')::date >= ?::date
		GROUP BY oi.product_id, sale_date
	`, branchID, startDate.Format("2006-01-02")).Scan(&rows).Error; err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Gagal menghitung data penjualan historis")
		return
	}

	seriesByProduct := make(map[string][]float64)
	for _, row := range rows {
		day, parseErr := time.ParseInLocation("2006-01-02", row.SaleDate, time.UTC)
		if parseErr != nil {
			continue
		}
		idx := int(day.Sub(startDate).Hours() / 24)
		if idx < 0 || idx >= lookbackDays {
			continue
		}
		series, ok := seriesByProduct[row.ProductID]
		if !ok {
			series = make([]float64, lookbackDays)
		}
		series[idx] += float64(row.Qty)
		seriesByProduct[row.ProductID] = series
	}

	var inventories []models.BranchInventory
	if err := config.DB.Preload("Product").Where("branch_id = ?", branchID).Find(&inventories).Error; err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Gagal memuat data inventori")
		return
	}

	items := make([]stockForecastItem, 0, len(inventories))
	var totalProducts, needRestock, criticalCount int
	var restockValue int64
	var coverSum float64
	var coverCount int

	for _, inv := range inventories {
		if inv.Product.ID == uuid.Nil {
			continue
		}

		series, ok := seriesByProduct[inv.Product.ID.String()]
		if !ok {
			series = make([]float64, lookbackDays)
		}
		stats := utils.AnalyzeDemand(series, algorithm, forecastEMAAlpha, forecastSMAWindow)

		predictedDemand := int(math.Round(stats.Smoothed * float64(horizonDays)))
		safetyStock := int(math.Round(forecastServiceLevelZ * stats.StdDev * math.Sqrt(float64(horizonDays))))
		reorderPoint := predictedDemand + safetyStock
		recommended := reorderPoint - inv.CurrentStock
		if recommended < 0 {
			recommended = 0
		}

		var daysOfCover *float64
		var stockoutDate *string
		if stats.Smoothed > 0 {
			cover := float64(inv.CurrentStock) / stats.Smoothed
			daysOfCover = &cover
			date := today.AddDate(0, 0, int(math.Floor(cover))).Format("2006-01-02")
			stockoutDate = &date
		}

		priority := "Rendah"
		if daysOfCover != nil {
			switch {
			case *daysOfCover <= 7:
				priority = "Tinggi"
			case *daysOfCover <= 14:
				priority = "Sedang"
			}
		}

		items = append(items, stockForecastItem{
			ProductID:             inv.Product.ID,
			Name:                  inv.Product.Name,
			SKU:                   inv.Product.SKU,
			CurrentStock:          inv.CurrentStock,
			LowStockThreshold:     inv.Product.LowStockThreshold,
			CostPriceIDR:          inv.Product.CostPriceIDR,
			SellingPriceIDR:       inv.Product.SellingPriceIDR,
			AvgDailyDemand:        roundToHundredths(stats.Mean),
			StdDevDailyDemand:     roundToHundredths(stats.StdDev),
			SmoothedDailyDemand:   roundToHundredths(stats.Smoothed),
			PredictedDemand:       predictedDemand,
			SafetyStock:           safetyStock,
			ReorderPoint:          reorderPoint,
			RecommendedReorderQty: recommended,
			DaysOfCover:           daysOfCover,
			EstimatedStockoutDate: stockoutDate,
			Priority:              priority,
		})

		totalProducts++
		if recommended > 0 {
			needRestock++
			restockValue += int64(recommended) * inv.Product.CostPriceIDR
		}
		if daysOfCover != nil {
			coverSum += *daysOfCover
			coverCount++
			if *daysOfCover <= 7 {
				criticalCount++
			}
		}
	}

	// Most urgent products first; products without demand trail alphabetically.
	sort.SliceStable(items, func(i, j int) bool {
		a, b := items[i].DaysOfCover, items[j].DaysOfCover
		if a == nil && b == nil {
			return items[i].Name < items[j].Name
		}
		if a == nil {
			return false
		}
		if b == nil {
			return true
		}
		return *a < *b
	})

	avgDaysOfCover := 0.0
	if coverCount > 0 {
		avgDaysOfCover = roundToHundredths(coverSum / float64(coverCount))
	}

	c.JSON(http.StatusOK, gin.H{
		"horizon_days":    horizonDays,
		"lookback_days":   lookbackDays,
		"algorithm":       algorithm,
		"service_level_z": forecastServiceLevelZ,
		"generated_at":    today.Format(time.RFC3339),
		"items":           items,
		"summary": gin.H{
			"total_products":              totalProducts,
			"need_restock":                needRestock,
			"critical_count":              criticalCount,
			"avg_days_of_cover":           avgDaysOfCover,
			"estimated_restock_value_idr": restockValue,
		},
	})
}

type forecastSeriesPoint struct {
	Date      string   `json:"date"`
	Label     string   `json:"label"`
	Actual    *int     `json:"actual"`
	Projected *float64 `json:"projected"`
	Phase     string   `json:"phase"`
}

// GetProductForecastSeries returns a single product's daily demand history plus
// the projected daily demand over the horizon, for charting.
// Query params: product_id (required), days (horizon), lookback, algorithm.
func GetProductForecastSeries(c *gin.Context) {
	branchID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		utils.RespondError(c, http.StatusBadRequest, "ID cabang tidak valid")
		return
	}

	productID, err := uuid.Parse(c.Query("product_id"))
	if err != nil {
		utils.RespondError(c, http.StatusBadRequest, "product_id tidak valid")
		return
	}

	var branch models.Branch
	if err := config.DB.First(&branch, "id = ?", branchID).Error; err != nil {
		utils.RespondError(c, http.StatusNotFound, "Cabang tidak ditemukan")
		return
	}

	var inv models.BranchInventory
	if err := config.DB.Preload("Product").
		Where("branch_id = ? AND product_id = ?", branchID, productID).
		First(&inv).Error; err != nil {
		utils.RespondError(c, http.StatusNotFound, "Produk tidak ditemukan pada cabang ini")
		return
	}

	horizonDays := parseBoundedQuery(c, "days", defaultForecastDays, 1, 180)
	lookbackDays := parseBoundedQuery(c, "lookback", defaultForecastLookback, 1, 365)
	algorithm := c.DefaultQuery("algorithm", "ema")
	if algorithm != "sma" {
		algorithm = "ema"
	}

	loc := time.FixedZone("WIB", 7*60*60)
	today := time.Now().In(loc)
	todayKey := today.Format("2006-01-02")
	start := today.AddDate(0, 0, -(lookbackDays - 1))
	startDate := time.Date(start.Year(), start.Month(), start.Day(), 0, 0, 0, 0, time.UTC)

	type saleRow struct {
		SaleDate string
		Qty      int
	}
	var rows []saleRow
	if err := config.DB.Raw(`
		SELECT to_char(o.created_at AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD') AS sale_date,
		       COALESCE(SUM(oi.qty), 0)::int AS qty
		FROM order_items oi
		JOIN orders o ON o.id = oi.order_id
		WHERE o.branch_id = ? AND oi.product_id = ?
		  AND o.payment_status <> 'refunded'
		  AND (o.created_at AT TIME ZONE 'Asia/Jakarta')::date >= ?::date
		GROUP BY sale_date
	`, branchID, productID, startDate.Format("2006-01-02")).Scan(&rows).Error; err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Gagal menghitung data penjualan historis")
		return
	}

	demand := make([]float64, lookbackDays)
	for _, row := range rows {
		day, parseErr := time.ParseInLocation("2006-01-02", row.SaleDate, time.UTC)
		if parseErr != nil {
			continue
		}
		idx := int(day.Sub(startDate).Hours() / 24)
		if idx < 0 || idx >= lookbackDays {
			continue
		}
		demand[idx] += float64(row.Qty)
	}

	stats := utils.AnalyzeDemand(demand, algorithm, forecastEMAAlpha, forecastSMAWindow)
	smoothed := roundToHundredths(stats.Smoothed)

	points := make([]forecastSeriesPoint, 0, lookbackDays+horizonDays)
	base := today.AddDate(0, 0, -(lookbackDays - 1))
	for i := 0; i < lookbackDays; i++ {
		d := base.AddDate(0, 0, i)
		key := d.Format("2006-01-02")
		actual := int(demand[i])
		point := forecastSeriesPoint{
			Date:   key,
			Label:  d.Format("02 Jan"),
			Actual: &actual,
			Phase:  "history",
		}
		if key == todayKey {
			projected := smoothed
			point.Projected = &projected
			point.Phase = "today"
		}
		points = append(points, point)
	}
	for i := 1; i <= horizonDays; i++ {
		d := today.AddDate(0, 0, i)
		projected := smoothed
		points = append(points, forecastSeriesPoint{
			Date:      d.Format("2006-01-02"),
			Label:     d.Format("02 Jan"),
			Projected: &projected,
			Phase:     "forecast",
		})
	}

	var daysOfCover *float64
	var stockoutDate *string
	if stats.Smoothed > 0 {
		cover := float64(inv.CurrentStock) / stats.Smoothed
		daysOfCover = &cover
		date := today.AddDate(0, 0, int(math.Floor(cover))).Format("2006-01-02")
		stockoutDate = &date
	}

	c.JSON(http.StatusOK, gin.H{
		"product": gin.H{
			"product_id":          inv.Product.ID,
			"name":                inv.Product.Name,
			"sku":                 inv.Product.SKU,
			"current_stock":       inv.CurrentStock,
			"low_stock_threshold": inv.Product.LowStockThreshold,
		},
		"lookback_days":           lookbackDays,
		"horizon_days":            horizonDays,
		"algorithm":               algorithm,
		"avg_daily_demand":        roundToHundredths(stats.Mean),
		"stddev_daily_demand":     roundToHundredths(stats.StdDev),
		"smoothed_daily_demand":   smoothed,
		"days_of_cover":           daysOfCover,
		"estimated_stockout_date": stockoutDate,
		"points":                  points,
	})
}
