package ai

import (
	"time"

	"backend/config"
	"backend/models"

	"github.com/google/uuid"
)

type salesTrendArgs struct {
	Days int `json:"days,omitempty" jsonschema:"rentang hari penjualan (1-90, default 14)"`
}

type dailySalesTrend struct {
	Date        string `json:"date"`
	RevenueIDR  int64  `gorm:"column:revenue_idr" json:"revenue_idr"`
	Orders      int    `json:"orders"`
	DiscountIDR int64  `gorm:"column:discount_idr" json:"discount_idr"`
	ItemsSold   int    `json:"items_sold"`
}

type salesTrendOutput struct {
	PeriodDays           int               `json:"period_days"`
	RevenueIDR           int64             `json:"revenue_idr"`
	Orders               int               `json:"orders"`
	DiscountIDR          int64             `json:"discount_idr"`
	ItemsSold            int               `json:"items_sold"`
	AverageOrderValueIDR int64             `json:"average_order_value_idr"`
	Daily                []dailySalesTrend `json:"daily"`
}

func (s Scope) salesTrend(in salesTrendArgs) (salesTrendOutput, error) {
	days := clampArg(in.Days, 1, 90, 14)
	startDate := wibStartDate(days)
	endDate := time.Now().In(time.FixedZone("WIB", 7*60*60)).Format("2006-01-02")

	var rows []dailySalesTrend
	err := aiDB().Raw(`
		WITH date_range AS (
			SELECT generate_series(?::date, ?::date, interval '1 day')::date AS sale_day
		), daily_orders AS (
			SELECT (created_at AT TIME ZONE 'Asia/Jakarta')::date AS sale_day,
			       COALESCE(SUM(total_amount_idr), 0)::bigint AS revenue_idr,
			       COUNT(*)::int AS orders,
			       COALESCE(SUM(discount_amount_idr), 0)::bigint AS discount_idr
			FROM orders
			WHERE branch_id = ? AND payment_status <> 'refunded'
			  AND (created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN ?::date AND ?::date
			GROUP BY sale_day
		), daily_items AS (
			SELECT (o.created_at AT TIME ZONE 'Asia/Jakarta')::date AS sale_day,
			       COALESCE(SUM(oi.qty), 0)::int AS items_sold
			FROM orders o
			JOIN order_items oi ON oi.order_id = o.id
			WHERE o.branch_id = ? AND o.payment_status <> 'refunded'
			  AND (o.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN ?::date AND ?::date
			GROUP BY sale_day
		)
		SELECT to_char(d.sale_day, 'YYYY-MM-DD') AS date,
		       COALESCE(o.revenue_idr, 0)::bigint AS revenue_idr,
		       COALESCE(o.orders, 0)::int AS orders,
		       COALESCE(o.discount_idr, 0)::bigint AS discount_idr,
		       COALESCE(i.items_sold, 0)::int AS items_sold
		FROM date_range d
		LEFT JOIN daily_orders o ON o.sale_day = d.sale_day
		LEFT JOIN daily_items i ON i.sale_day = d.sale_day
		ORDER BY d.sale_day
	`, startDate, endDate, s.BranchID, startDate, endDate, s.BranchID, startDate, endDate).Scan(&rows).Error
	if err != nil {
		return salesTrendOutput{}, err
	}

	out := salesTrendOutput{PeriodDays: days, Daily: rows}
	for _, row := range rows {
		out.RevenueIDR += row.RevenueIDR
		out.Orders += row.Orders
		out.DiscountIDR += row.DiscountIDR
		out.ItemsSold += row.ItemsSold
	}
	if out.Orders > 0 {
		out.AverageOrderValueIDR = out.RevenueIDR / int64(out.Orders)
	}
	return out, nil
}

type paymentBreakdownArgs struct {
	Days int `json:"days,omitempty" jsonschema:"rentang hari (1-180, default 30)"`
}

type paymentMethodRow struct {
	Method      string `json:"method"`
	Orders      int    `json:"orders"`
	RevenueIDR  int64  `gorm:"column:revenue_idr" json:"revenue_idr"`
	DiscountIDR int64  `gorm:"column:discount_idr" json:"discount_idr"`
}

type paymentMethodItem struct {
	Method      string  `json:"method"`
	Orders      int     `json:"orders"`
	RevenueIDR  int64   `json:"revenue_idr"`
	DiscountIDR int64   `json:"discount_idr"`
	SharePct    float64 `json:"share_pct"`
}

type paymentBreakdownOutput struct {
	PeriodDays      int                 `json:"period_days"`
	TotalOrders     int                 `json:"total_orders"`
	TotalRevenueIDR int64               `json:"total_revenue_idr"`
	Methods         []paymentMethodItem `json:"methods"`
}

func (s Scope) paymentMethodBreakdown(in paymentBreakdownArgs) (paymentBreakdownOutput, error) {
	days := clampArg(in.Days, 1, 180, 30)
	rows := []paymentMethodRow{}
	if err := aiDB().Raw(`
		SELECT payment_method AS method,
		       COUNT(*)::int AS orders,
		       COALESCE(SUM(total_amount_idr), 0)::bigint AS revenue_idr,
		       COALESCE(SUM(discount_amount_idr), 0)::bigint AS discount_idr
		FROM orders
		WHERE branch_id = ? AND payment_status <> 'refunded'
		  AND (created_at AT TIME ZONE 'Asia/Jakarta')::date >= ?::date
		GROUP BY payment_method
		ORDER BY revenue_idr DESC, payment_method ASC
	`, s.BranchID, wibStartDate(days)).Scan(&rows).Error; err != nil {
		return paymentBreakdownOutput{}, err
	}

	out := paymentBreakdownOutput{PeriodDays: days, Methods: make([]paymentMethodItem, 0, len(rows))}
	for _, row := range rows {
		out.TotalOrders += row.Orders
		out.TotalRevenueIDR += row.RevenueIDR
	}
	for _, row := range rows {
		item := paymentMethodItem{
			Method:      row.Method,
			Orders:      row.Orders,
			RevenueIDR:  row.RevenueIDR,
			DiscountIDR: row.DiscountIDR,
		}
		if out.TotalRevenueIDR > 0 {
			item.SharePct = float64(row.RevenueIDR) * 100 / float64(out.TotalRevenueIDR)
		}
		out.Methods = append(out.Methods, item)
	}
	return out, nil
}

type inventoryValuationOutput struct {
	Products                int   `json:"products"`
	UnitsOnHand             int   `json:"units_on_hand"`
	InStockProducts         int   `json:"in_stock_products"`
	LowStockProducts        int   `json:"low_stock_products"`
	OutOfStockProducts      int   `json:"out_of_stock_products"`
	InventoryCostValueIDR   int64 `json:"inventory_cost_value_idr"`
	PotentialSalesValueIDR  int64 `json:"potential_sales_value_idr"`
	PotentialGrossProfitIDR int64 `json:"potential_gross_profit_idr"`
}

func (s Scope) inventoryValuation() (inventoryValuationOutput, error) {
	var inventories []models.BranchInventory
	err := aiDB().Preload("Product").Where("branch_id = ?", s.BranchID).Find(&inventories).Error
	if (err != nil || !hasValuationProducts(inventories)) && config.AIDB != nil && config.AIDB != config.DB {
		var primaryInventories []models.BranchInventory
		primaryErr := config.DB.Preload("Product").Where("branch_id = ?", s.BranchID).Find(&primaryInventories).Error
		if primaryErr == nil && hasValuationProducts(primaryInventories) {
			inventories = primaryInventories
			err = nil
		}
	}
	if err != nil {
		return inventoryValuationOutput{}, err
	}

	out := inventoryValuationOutput{}
	for _, inventory := range inventories {
		product := inventory.Product
		if product.ID == uuid.Nil {
			continue
		}
		out.Products++
		out.UnitsOnHand += inventory.CurrentStock
		out.InventoryCostValueIDR += product.CostPriceIDR * int64(inventory.CurrentStock)
		out.PotentialSalesValueIDR += product.SellingPriceIDR * int64(inventory.CurrentStock)
		if inventory.CurrentStock <= 0 {
			out.OutOfStockProducts++
		} else if inventory.CurrentStock <= product.LowStockThreshold {
			out.LowStockProducts++
		} else {
			out.InStockProducts++
		}
	}
	out.PotentialGrossProfitIDR = out.PotentialSalesValueIDR - out.InventoryCostValueIDR
	return out, nil
}

func hasValuationProducts(inventories []models.BranchInventory) bool {
	for _, inventory := range inventories {
		if inventory.Product.ID != uuid.Nil {
			return true
		}
	}
	return false
}

type employeeOverviewGroup struct {
	Role   string `json:"role"`
	Status string `json:"status"`
	Count  int    `json:"count"`
}

type employeeOverviewOutput struct {
	TotalEmployees   int                     `json:"total_employees"`
	ActiveEmployees  int                     `json:"active_employees"`
	OnLeaveEmployees int                     `json:"on_leave_employees"`
	ByRoleAndStatus  []employeeOverviewGroup `json:"by_role_and_status"`
}

func (s Scope) employeeOverview() (employeeOverviewOutput, error) {
	groups := []employeeOverviewGroup{}
	if err := aiDB().Raw(`
		SELECT role, status, COUNT(*)::int AS count
		FROM employees
		WHERE business_id = ? AND branch_id = ? AND deleted_at IS NULL
		GROUP BY role, status
		ORDER BY role, status
	`, s.BusinessID, s.BranchID).Scan(&groups).Error; err != nil {
		return employeeOverviewOutput{}, err
	}

	out := employeeOverviewOutput{ByRoleAndStatus: groups}
	for _, group := range groups {
		out.TotalEmployees += group.Count
		switch group.Status {
		case "Aktif":
			out.ActiveEmployees += group.Count
		case "Cuti":
			out.OnLeaveEmployees += group.Count
		}
	}
	return out, nil
}

type attendanceReportArgs struct {
	Days  int `json:"days,omitempty" jsonschema:"rentang hari presensi (1-90, default 30)"`
	Limit int `json:"limit,omitempty" jsonschema:"jumlah pegawai pada ringkasan per pegawai (1-50, default 10)"`
}

type dailyAttendanceRow struct {
	Date         string `json:"date"`
	Records      int    `json:"records"`
	ClockIns     int    `json:"clock_ins"`
	ClockOuts    int    `json:"clock_outs"`
	LateArrivals int    `json:"late_arrivals"`
}

type employeeAttendanceRow struct {
	Name             string `json:"name"`
	Role             string `json:"role"`
	AttendanceDays   int    `json:"attendance_days"`
	LateArrivals     int    `json:"late_arrivals"`
	IncompleteShifts int    `json:"incomplete_shifts"`
}

type attendanceReportOutput struct {
	PeriodDays        int                     `json:"period_days"`
	AttendanceRecords int                     `json:"attendance_records"`
	ClockIns          int                     `json:"clock_ins"`
	ClockOuts         int                     `json:"clock_outs"`
	LateArrivals      int                     `json:"late_arrivals"`
	Daily             []dailyAttendanceRow    `json:"daily"`
	Employees         []employeeAttendanceRow `json:"employees"`
}

func (s Scope) attendanceReport(in attendanceReportArgs) (attendanceReportOutput, error) {
	days := clampArg(in.Days, 1, 90, 30)
	limit := clampArg(in.Limit, 1, 50, 10)
	startDate := wibStartDate(days)
	endDate := time.Now().In(time.FixedZone("WIB", 7*60*60)).Format("2006-01-02")

	daily := []dailyAttendanceRow{}
	if err := aiDB().Raw(`
		WITH date_range AS (
			SELECT generate_series(?::date, ?::date, interval '1 day')::date AS attendance_day
		), attendance_by_day AS (
			SELECT attendance_date::date AS attendance_day,
			       COUNT(*)::int AS records,
			       COUNT(*) FILTER (WHERE clock_in IS NOT NULL)::int AS clock_ins,
			       COUNT(*) FILTER (WHERE clock_out IS NOT NULL)::int AS clock_outs,
			       COUNT(*) FILTER (WHERE status = 'Terlambat')::int AS late_arrivals
			FROM employee_attendances
			WHERE business_id = ? AND branch_id = ?
			  AND attendance_date BETWEEN ?::date AND ?::date
			GROUP BY attendance_day
		)
		SELECT to_char(d.attendance_day, 'YYYY-MM-DD') AS date,
		       COALESCE(a.records, 0)::int AS records,
		       COALESCE(a.clock_ins, 0)::int AS clock_ins,
		       COALESCE(a.clock_outs, 0)::int AS clock_outs,
		       COALESCE(a.late_arrivals, 0)::int AS late_arrivals
		FROM date_range d
		LEFT JOIN attendance_by_day a ON a.attendance_day = d.attendance_day
		ORDER BY d.attendance_day
	`, startDate, endDate, s.BusinessID, s.BranchID, startDate, endDate).Scan(&daily).Error; err != nil {
		return attendanceReportOutput{}, err
	}

	employees := []employeeAttendanceRow{}
	if err := aiDB().Raw(`
		SELECT e.name AS name,
		       e.role AS role,
		       COUNT(a.id) FILTER (WHERE a.clock_in IS NOT NULL)::int AS attendance_days,
		       COUNT(a.id) FILTER (WHERE a.status = 'Terlambat')::int AS late_arrivals,
		       COUNT(a.id) FILTER (WHERE a.clock_in IS NOT NULL AND a.clock_out IS NULL)::int AS incomplete_shifts
		FROM employees e
		LEFT JOIN employee_attendances a ON a.employee_id = e.id
		  AND a.business_id = e.business_id AND a.branch_id = e.branch_id
		  AND a.attendance_date BETWEEN ?::date AND ?::date
		WHERE e.business_id = ? AND e.branch_id = ?
		  AND e.deleted_at IS NULL AND e.status = 'Aktif'
		GROUP BY e.id, e.name, e.role
		ORDER BY late_arrivals DESC, attendance_days DESC, e.name ASC
		LIMIT ?
	`, startDate, endDate, s.BusinessID, s.BranchID, limit).Scan(&employees).Error; err != nil {
		return attendanceReportOutput{}, err
	}

	out := attendanceReportOutput{
		PeriodDays: days,
		Daily:      daily,
		Employees:  employees,
	}
	for _, row := range daily {
		out.AttendanceRecords += row.Records
		out.ClockIns += row.ClockIns
		out.ClockOuts += row.ClockOuts
		out.LateArrivals += row.LateArrivals
	}
	return out, nil
}
