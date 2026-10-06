package ai

import (
	"context"
	"math"
	"sort"
	"strings"
	"time"

	"backend/config"
	"backend/models"
	"backend/utils"

	"github.com/google/uuid"
	mcp "github.com/modelcontextprotocol/go-sdk/mcp"
	"gorm.io/gorm"
)

// Forecasting constants mirror the branch forecast controller so the assistant
// reports the same numbers the Stock Forecast tab shows.
const (
	toolForecastServiceLevelZ = 1.65
	toolForecastEMAAlpha      = 0.3
	toolForecastSMAWindow     = 7
	toolForecastLookbackDays  = 30
	toolForecastHorizonDays   = 14
)

// Scope binds an assistant session to one tenant. Tools read these fields
// instead of accepting ids from the model, so the assistant can never reach
// another business's or branch's data.
type Scope struct {
	BusinessID uuid.UUID
	BranchID   uuid.UUID
	BranchName string
}

func aiDB() *gorm.DB {
	if config.AIDB != nil {
		return config.AIDB
	}
	return config.DB
}

func wibStartDate(days int) string {
	loc := time.FixedZone("WIB", 7*60*60)
	start := time.Now().In(loc).AddDate(0, 0, -(days - 1))
	return start.Format("2006-01-02")
}

func clampArg(value, min, max, fallback int) int {
	if value == 0 {
		return fallback
	}
	if value < min {
		return min
	}
	if value > max {
		return max
	}
	return value
}

func readOnly(title string) *mcp.ToolAnnotations {
	return &mcp.ToolAnnotations{ReadOnlyHint: true, Title: title}
}

// NewServer builds an MCP server whose tools are bound to scope. The model sees
// fixed, tenant-agnostic tool schemas; the tenant is applied inside the handlers.
func NewServer(scope Scope) *mcp.Server {
	server := mcp.NewServer(&mcp.Implementation{
		Name:        "simpl-abai",
		Title:       "ABAI assistant",
		Version:     "1.0.0",
		Description: "Akses baca-saja ke data operasional cabang SIMPL.",
	}, nil)

	mcp.AddTool(server, &mcp.Tool{
		Name: "get_sales_summary",
		Description: "Ringkasan penjualan cabang: pendapatan, jumlah transaksi, item terjual, dan nilai transaksi rata-rata " +
			"untuk periode tertentu, ditambah angka hari ini.",
		Annotations: readOnly("Ringkasan penjualan"),
	}, func(_ context.Context, _ *mcp.CallToolRequest, in salesSummaryArgs) (*mcp.CallToolResult, salesSummaryOutput, error) {
		out, err := scope.salesSummary(in)
		return nil, out, err
	})

	mcp.AddTool(server, &mcp.Tool{
		Name:        "get_top_products",
		Description: "Produk paling laris berdasarkan jumlah unit terjual dalam periode tertentu.",
		Annotations: readOnly("Produk terlaris"),
	}, func(_ context.Context, _ *mcp.CallToolRequest, in topProductsArgs) (*mcp.CallToolResult, topProductsOutput, error) {
		out, err := scope.topProducts(in)
		return nil, out, err
	})

	mcp.AddTool(server, &mcp.Tool{
		Name:        "get_low_stock_products",
		Description: "Produk dengan stok menipis atau habis di cabang ini, diurutkan dari yang paling kritis.",
		Annotations: readOnly("Stok menipis"),
	}, func(_ context.Context, _ *mcp.CallToolRequest, in lowStockArgs) (*mcp.CallToolResult, lowStockOutput, error) {
		out, err := scope.lowStockProducts(in)
		return nil, out, err
	})

	mcp.AddTool(server, &mcp.Tool{
		Name:        "find_product_stock",
		Description: "Cari stok dan harga jual produk tertentu berdasarkan nama atau SKU.",
		Annotations: readOnly("Cari stok produk"),
	}, func(_ context.Context, _ *mcp.CallToolRequest, in productStockArgs) (*mcp.CallToolResult, productStockOutput, error) {
		out, err := scope.findProductStock(in)
		return nil, out, err
	})

	mcp.AddTool(server, &mcp.Tool{
		Name:        "get_customer_overview",
		Description: "Jumlah pelanggan terdaftar, pelanggan baru dalam periode tertentu, dan 5 pelanggan dengan belanja seumur hidup terbesar. Total belanja dan pesanan hanya menghitung transaksi lunas, sama seperti halaman pelanggan; periode hanya berlaku untuk pelanggan baru.",
		Annotations: readOnly("Ringkasan pelanggan"),
	}, func(_ context.Context, _ *mcp.CallToolRequest, in customerOverviewArgs) (*mcp.CallToolResult, customerOverviewOutput, error) {
		out, err := scope.customerOverview(in)
		return nil, out, err
	})

	mcp.AddTool(server, &mcp.Tool{
		Name:        "get_restock_recommendations",
		Description: "Rekomendasi jumlah pesan ulang per produk memakai proyeksi permintaan (Welford + smoothing) dan safety stock.",
		Annotations: readOnly("Rekomendasi pesan ulang"),
	}, func(_ context.Context, _ *mcp.CallToolRequest, in restockArgs) (*mcp.CallToolResult, restockOutput, error) {
		out, err := scope.restockRecommendations(in)
		return nil, out, err
	})

	mcp.AddTool(server, &mcp.Tool{
		Name:        "get_sales_trend",
		Description: "Laporan tren penjualan harian untuk cabang ini, termasuk pendapatan, transaksi, diskon, dan jumlah item selama 1-90 hari.",
		Annotations: readOnly("Tren penjualan harian"),
	}, func(_ context.Context, _ *mcp.CallToolRequest, in salesTrendArgs) (*mcp.CallToolResult, salesTrendOutput, error) {
		out, err := scope.salesTrend(in)
		return nil, out, err
	})

	mcp.AddTool(server, &mcp.Tool{
		Name:        "get_payment_method_breakdown",
		Description: "Laporan jumlah transaksi, pendapatan, diskon, dan kontribusi persentase tiap metode pembayaran selama periode tertentu.",
		Annotations: readOnly("Laporan metode pembayaran"),
	}, func(_ context.Context, _ *mcp.CallToolRequest, in paymentBreakdownArgs) (*mcp.CallToolResult, paymentBreakdownOutput, error) {
		out, err := scope.paymentMethodBreakdown(in)
		return nil, out, err
	})

	mcp.AddTool(server, &mcp.Tool{
		Name:        "get_inventory_valuation",
		Description: "Ringkasan nilai persediaan cabang berdasarkan harga modal dan harga jual, serta jumlah produk aman, menipis, atau habis.",
		Annotations: readOnly("Nilai persediaan"),
	}, func(_ context.Context, _ *mcp.CallToolRequest, _ struct{}) (*mcp.CallToolResult, inventoryValuationOutput, error) {
		out, err := scope.inventoryValuation()
		return nil, out, err
	})

	mcp.AddTool(server, &mcp.Tool{
		Name:        "get_employee_overview",
		Description: "Ringkasan pegawai cabang berdasarkan status dan peran, tanpa menampilkan informasi kontak pribadi.",
		Annotations: readOnly("Ringkasan pegawai"),
	}, func(_ context.Context, _ *mcp.CallToolRequest, _ struct{}) (*mcp.CallToolResult, employeeOverviewOutput, error) {
		out, err := scope.employeeOverview()
		return nil, out, err
	})

	mcp.AddTool(server, &mcp.Tool{
		Name:        "get_attendance_report",
		Description: "Laporan presensi 1-90 hari terakhir: tren harian, jumlah hadir/terlambat, clock-out, dan pegawai dengan catatan kehadiran terbanyak.",
		Annotations: readOnly("Laporan presensi"),
	}, func(_ context.Context, _ *mcp.CallToolRequest, in attendanceReportArgs) (*mcp.CallToolResult, attendanceReportOutput, error) {
		out, err := scope.attendanceReport(in)
		return nil, out, err
	})

	return server
}

type salesSummaryArgs struct {
	Days int `json:"days,omitempty" jsonschema:"jumlah hari ke belakang (1-90, default 7)"`
}

type salesSummaryOutput struct {
	PeriodDays           int   `json:"period_days"`
	RevenueIDR           int64 `json:"revenue_idr"`
	Orders               int   `json:"orders"`
	ItemsSold            int   `json:"items_sold"`
	DiscountIDR          int64 `json:"discount_idr"`
	AverageOrderValueIDR int64 `json:"average_order_value_idr"`
	TodayRevenueIDR      int64 `json:"today_revenue_idr"`
	TodayOrders          int   `json:"today_orders"`
}

func (s Scope) salesSummary(in salesSummaryArgs) (salesSummaryOutput, error) {
	days := clampArg(in.Days, 1, 90, 7)
	start := wibStartDate(days)
	out := salesSummaryOutput{PeriodDays: days}

	var period struct {
		Revenue  int64
		Orders   int
		Discount int64
	}
	if err := aiDB().Raw(`
		SELECT COALESCE(SUM(total_amount_idr), 0)::bigint AS revenue,
		       COUNT(*)::int AS orders,
		       COALESCE(SUM(discount_amount_idr), 0)::bigint AS discount
		FROM orders
		WHERE branch_id = ? AND payment_status <> 'refunded'
		  AND (created_at AT TIME ZONE 'Asia/Jakarta')::date >= ?::date
	`, s.BranchID, start).Scan(&period).Error; err != nil {
		return out, err
	}
	out.RevenueIDR = period.Revenue
	out.Orders = period.Orders
	out.DiscountIDR = period.Discount
	if period.Orders > 0 {
		out.AverageOrderValueIDR = period.Revenue / int64(period.Orders)
	}

	var items int
	if err := aiDB().Raw(`
		SELECT COALESCE(SUM(oi.qty), 0)::int
		FROM order_items oi
		JOIN orders o ON o.id = oi.order_id
		WHERE o.branch_id = ? AND o.payment_status <> 'refunded'
		  AND (o.created_at AT TIME ZONE 'Asia/Jakarta')::date >= ?::date
	`, s.BranchID, start).Scan(&items).Error; err != nil {
		return out, err
	}
	out.ItemsSold = items

	var today struct {
		Revenue int64
		Orders  int
	}
	if err := aiDB().Raw(`
		SELECT COALESCE(SUM(total_amount_idr), 0)::bigint AS revenue, COUNT(*)::int AS orders
		FROM orders
		WHERE branch_id = ? AND payment_status <> 'refunded'
		  AND (created_at AT TIME ZONE 'Asia/Jakarta')::date = ?::date
	`, s.BranchID, wibStartDate(1)).Scan(&today).Error; err != nil {
		return out, err
	}
	out.TodayRevenueIDR = today.Revenue
	out.TodayOrders = today.Orders

	return out, nil
}

type topProductsArgs struct {
	Days  int `json:"days,omitempty" jsonschema:"jumlah hari ke belakang (1-180, default 30)"`
	Limit int `json:"limit,omitempty" jsonschema:"jumlah maksimum produk (1-20, default 5)"`
}

type productSales struct {
	Name       string `json:"name"`
	SKU        string `json:"sku"`
	QtySold    int    `json:"qty_sold"`
	RevenueIDR int64  `gorm:"column:revenue_idr" json:"revenue_idr"`
}

type topProductsOutput struct {
	PeriodDays int            `json:"period_days"`
	Products   []productSales `json:"products"`
}

func (s Scope) topProducts(in topProductsArgs) (topProductsOutput, error) {
	days := clampArg(in.Days, 1, 180, 30)
	limit := clampArg(in.Limit, 1, 20, 5)

	rows := []productSales{}
	if err := aiDB().Raw(`
		SELECT p.name AS name,
		       p.sku AS sku,
		       COALESCE(SUM(oi.qty), 0)::int AS qty_sold,
		       COALESCE(SUM(oi.subtotal_idr), 0)::bigint AS revenue_idr
		FROM order_items oi
		JOIN orders o ON o.id = oi.order_id
		JOIN products p ON p.id = oi.product_id
		WHERE o.branch_id = ? AND o.payment_status <> 'refunded'
		  AND p.deleted_at IS NULL
		  AND (o.created_at AT TIME ZONE 'Asia/Jakarta')::date >= ?::date
		GROUP BY p.id, p.name, p.sku
		ORDER BY qty_sold DESC, p.name ASC
		LIMIT ?
	`, s.BranchID, wibStartDate(days), limit).Scan(&rows).Error; err != nil {
		return topProductsOutput{}, err
	}

	return topProductsOutput{PeriodDays: days, Products: rows}, nil
}

type lowStockArgs struct {
	Limit int `json:"limit,omitempty" jsonschema:"jumlah maksimum produk (1-50, default 10)"`
}

type stockItem struct {
	Name              string `json:"name"`
	SKU               string `json:"sku"`
	CurrentStock      int    `json:"current_stock"`
	LowStockThreshold int    `json:"low_stock_threshold"`
	Status            string `json:"status"`
}

type lowStockOutput struct {
	OutOfStock int         `json:"out_of_stock"`
	LowStock   int         `json:"low_stock"`
	Items      []stockItem `json:"items"`
}

func (s Scope) lowStockProducts(in lowStockArgs) (lowStockOutput, error) {
	limit := clampArg(in.Limit, 1, 50, 10)

	items := []stockItem{}
	if err := aiDB().Raw(`
		SELECT p.name AS name,
		       p.sku AS sku,
		       bi.current_stock AS current_stock,
		       p.low_stock_threshold AS low_stock_threshold
		FROM branch_inventory bi
		JOIN products p ON p.id = bi.product_id
		WHERE bi.branch_id = ? AND p.deleted_at IS NULL
		  AND bi.current_stock <= p.low_stock_threshold
		ORDER BY (bi.current_stock <= 0) DESC, bi.current_stock ASC, p.name ASC
		LIMIT ?
	`, s.BranchID, limit).Scan(&items).Error; err != nil {
		return lowStockOutput{}, err
	}
	for i := range items {
		if items[i].CurrentStock <= 0 {
			items[i].Status = "habis"
		} else {
			items[i].Status = "menipis"
		}
	}

	var counts struct {
		OutCount int
		LowCount int
	}
	if err := aiDB().Raw(`
		SELECT COUNT(*) FILTER (WHERE bi.current_stock <= 0)::int AS out_count,
		       COUNT(*) FILTER (WHERE bi.current_stock > 0 AND bi.current_stock <= p.low_stock_threshold)::int AS low_count
		FROM branch_inventory bi
		JOIN products p ON p.id = bi.product_id
		WHERE bi.branch_id = ? AND p.deleted_at IS NULL
	`, s.BranchID).Scan(&counts).Error; err != nil {
		return lowStockOutput{}, err
	}

	return lowStockOutput{OutOfStock: counts.OutCount, LowStock: counts.LowCount, Items: items}, nil
}

type productStockArgs struct {
	Query string `json:"query" jsonschema:"nama produk atau SKU yang dicari (wajib)"`
	Limit int    `json:"limit,omitempty" jsonschema:"jumlah maksimum hasil (1-20, default 5)"`
}

type productStockItem struct {
	Name              string `json:"name"`
	SKU               string `json:"sku"`
	SellingPriceIDR   int64  `gorm:"column:selling_price_idr" json:"selling_price_idr"`
	CurrentStock      int    `json:"current_stock"`
	LowStockThreshold int    `json:"low_stock_threshold"`
}

type productStockOutput struct {
	Query string             `json:"query"`
	Items []productStockItem `json:"items"`
}

func (s Scope) findProductStock(in productStockArgs) (productStockOutput, error) {
	query := strings.TrimSpace(in.Query)
	if query == "" {
		return productStockOutput{}, errInvalidToolArgument("query produk wajib diisi")
	}
	limit := clampArg(in.Limit, 1, 20, 5)
	pattern := "%" + query + "%"

	items := []productStockItem{}
	if err := aiDB().Raw(`
		SELECT p.name AS name,
		       p.sku AS sku,
		       p.selling_price_idr AS selling_price_idr,
		       COALESCE(bi.current_stock, 0)::int AS current_stock,
		       p.low_stock_threshold AS low_stock_threshold
		FROM products p
		LEFT JOIN branch_inventory bi ON bi.product_id = p.id AND bi.branch_id = ?
		WHERE p.business_id = ? AND p.deleted_at IS NULL
		  AND (p.name ILIKE ? OR p.sku ILIKE ?)
		ORDER BY p.name ASC
		LIMIT ?
	`, s.BranchID, s.BusinessID, pattern, pattern, limit).Scan(&items).Error; err != nil {
		return productStockOutput{}, err
	}

	return productStockOutput{Query: query, Items: items}, nil
}

type customerOverviewArgs struct {
	Days int `json:"days,omitempty" jsonschema:"rentang hari untuk pelanggan baru (1-365, default 30)"`
}

type customerSpend struct {
	Name          string `json:"name"`
	TotalSpendIDR int64  `gorm:"column:total_spend_idr" json:"total_spend_idr"`
	Orders        int    `gorm:"column:orders" json:"orders"`
}

type customerOverviewOutput struct {
	PeriodDays     int             `json:"period_days"`
	TotalCustomers int             `json:"total_customers"`
	NewCustomers   int             `json:"new_customers"`
	TopCustomers   []customerSpend `json:"top_customers"`
}

func (s Scope) customerOverview(in customerOverviewArgs) (customerOverviewOutput, error) {
	days := clampArg(in.Days, 1, 365, 30)
	out := customerOverviewOutput{PeriodDays: days}

	if err := aiDB().Raw(`
		SELECT COUNT(*)::int FROM customers
		WHERE business_id = ? AND deleted_at IS NULL
	`, s.BusinessID).Scan(&out.TotalCustomers).Error; err != nil {
		return out, err
	}

	if err := aiDB().Raw(`
		SELECT COUNT(*)::int FROM customers
		WHERE business_id = ? AND deleted_at IS NULL
		  AND (created_at AT TIME ZONE 'Asia/Jakarta')::date >= ?::date
	`, s.BusinessID, wibStartDate(days)).Scan(&out.NewCustomers).Error; err != nil {
		return out, err
	}

	out.TopCustomers = []customerSpend{}
	if err := aiDB().Raw(`
		SELECT c.name AS name,
		       COALESCE(SUM(o.total_amount_idr), 0)::bigint AS total_spend_idr,
		       COUNT(o.id)::int AS orders
		FROM customers c
		LEFT JOIN orders o ON o.customer_id = c.id
		  AND o.business_id = c.business_id
		  AND LOWER(o.payment_status) = 'paid'
		WHERE c.business_id = ? AND c.deleted_at IS NULL
		GROUP BY c.id, c.name
		ORDER BY total_spend_idr DESC
		LIMIT 5
	`, s.BusinessID).Scan(&out.TopCustomers).Error; err != nil {
		return out, err
	}

	return out, nil
}

type restockArgs struct {
	Days int `json:"days,omitempty" jsonschema:"horizon proyeksi dalam hari (1-60, default 14)"`
}

type restockItem struct {
	Name                  string   `json:"name"`
	SKU                   string   `json:"sku"`
	CurrentStock          int      `json:"current_stock"`
	PredictedDemand       int      `json:"predicted_demand"`
	SafetyStock           int      `json:"safety_stock"`
	RecommendedReorderQty int      `json:"recommended_reorder_qty"`
	DaysOfCover           *float64 `json:"days_of_cover,omitempty"`
}

type restockOutput struct {
	HorizonDays  int           `json:"horizon_days"`
	LookbackDays int           `json:"lookback_days"`
	Items        []restockItem `json:"items"`
}

func (s Scope) restockRecommendations(in restockArgs) (restockOutput, error) {
	horizon := clampArg(in.Days, 1, 60, toolForecastHorizonDays)
	lookback := toolForecastLookbackDays
	start := wibStartDate(lookback)

	type saleRow struct {
		ProductID string
		SaleDate  string
		Qty       int
	}
	var rows []saleRow
	if err := aiDB().Raw(`
		SELECT oi.product_id::text AS product_id,
		       to_char(o.created_at AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD') AS sale_date,
		       COALESCE(SUM(oi.qty), 0)::int AS qty
		FROM order_items oi
		JOIN orders o ON o.id = oi.order_id
		WHERE o.branch_id = ? AND o.payment_status <> 'refunded'
		  AND (o.created_at AT TIME ZONE 'Asia/Jakarta')::date >= ?::date
		GROUP BY oi.product_id, sale_date
	`, s.BranchID, start).Scan(&rows).Error; err != nil {
		return restockOutput{}, err
	}

	startDate, _ := time.ParseInLocation("2006-01-02", start, time.UTC)
	seriesByProduct := make(map[string][]float64)
	for _, row := range rows {
		day, parseErr := time.ParseInLocation("2006-01-02", row.SaleDate, time.UTC)
		if parseErr != nil {
			continue
		}
		idx := int(day.Sub(startDate).Hours() / 24)
		if idx < 0 || idx >= lookback {
			continue
		}
		series, ok := seriesByProduct[row.ProductID]
		if !ok {
			series = make([]float64, lookback)
		}
		series[idx] += float64(row.Qty)
		seriesByProduct[row.ProductID] = series
	}

	var inventories []models.BranchInventory
	if err := aiDB().Preload("Product").Where("branch_id = ?", s.BranchID).Find(&inventories).Error; err != nil {
		return restockOutput{}, err
	}

	items := make([]restockItem, 0, len(inventories))
	for _, inv := range inventories {
		if inv.Product.ID == uuid.Nil {
			continue
		}
		series := seriesByProduct[inv.Product.ID.String()]
		if series == nil {
			series = make([]float64, lookback)
		}
		stats := utils.AnalyzeDemand(series, "ema", toolForecastEMAAlpha, toolForecastSMAWindow)
		predicted := int(math.Round(stats.Smoothed * float64(horizon)))
		safety := int(math.Round(toolForecastServiceLevelZ * stats.StdDev * math.Sqrt(float64(horizon))))
		recommended := predicted + safety - inv.CurrentStock
		if recommended <= 0 {
			continue
		}
		item := restockItem{
			Name:                  inv.Product.Name,
			SKU:                   inv.Product.SKU,
			CurrentStock:          inv.CurrentStock,
			PredictedDemand:       predicted,
			SafetyStock:           safety,
			RecommendedReorderQty: recommended,
		}
		if stats.Smoothed > 0 {
			cover := math.Round(float64(inv.CurrentStock)/stats.Smoothed*100) / 100
			item.DaysOfCover = &cover
		}
		items = append(items, item)
	}

	sort.SliceStable(items, func(i, j int) bool {
		return items[i].RecommendedReorderQty > items[j].RecommendedReorderQty
	})
	if len(items) > 10 {
		items = items[:10]
	}

	return restockOutput{HorizonDays: horizon, LookbackDays: lookback, Items: items}, nil
}
