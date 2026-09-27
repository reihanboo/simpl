package controllers

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"backend/config"
	"backend/models"
	"backend/utils"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

const maxCustomerPageSize = 100

type customerInput struct {
	Name  string `json:"name" binding:"required,max=255"`
	Phone string `json:"phone" binding:"omitempty,max=20"`
	Email string `json:"email" binding:"omitempty,email,max=100"`
}

type customerSummary struct {
	models.Customer
	OrderCount       int64      `gorm:"column:order_count" json:"orders"`
	LifetimeValueIDR int64      `gorm:"column:lifetime_value_idr" json:"lifetime_value_idr"`
	LastVisit        *time.Time `gorm:"column:last_visit" json:"last_visit"`
	Type             string     `gorm:"-" json:"type"`
}

type customerStats struct {
	TotalCustomers     int64   `json:"total_customers"`
	NewCustomers       int64   `json:"new_customers"`
	ReturningCustomers int64   `json:"returning_customers"`
	ReturningRate    float64 `json:"returning_rate"`
	LifetimeValueIDR int64   `json:"lifetime_value_idr"`
}

type customerOrderItemResponse struct {
	ID           uuid.UUID `json:"id"`
	ProductID    uuid.UUID `json:"product_id"`
	ProductName  string    `json:"product_name"`
	Qty          int       `json:"qty"`
	UnitPriceIDR int64     `json:"unit_price_idr"`
	SubtotalIDR  int64     `json:"subtotal_idr"`
}

type customerOrderResponse struct {
	ID                uuid.UUID                 `json:"id"`
	OrderNumber       string                    `json:"order_number"`
	TotalAmountIDR    int64                     `json:"total_amount_idr"`
	DiscountAmountIDR int64                     `json:"discount_amount_idr"`
	PaymentMethod     string                    `json:"payment_method"`
	PaymentStatus     string                    `json:"payment_status"`
	CreatedAt         time.Time                 `json:"created_at"`
	Items             []customerOrderItemResponse `json:"items"`
}

func GetCustomers(c *gin.Context) {
	businessID, ok := getAuthorizedEnterpriseBusiness(c)
	if !ok {
		return
	}

	page, pageSize, ok := customerPagination(c)
	if !ok {
		return
	}

	baseQuery := config.DB.Model(&models.Customer{}).Where("customers.business_id = ?", businessID)
	if query := strings.TrimSpace(c.Query("q")); query != "" {
		pattern := "%" + query + "%"
		baseQuery = baseQuery.Where("(customers.name ILIKE ? OR customers.email ILIKE ? OR customers.phone ILIKE ?)", pattern, pattern, pattern)
	}

	switch strings.ToLower(strings.TrimSpace(c.Query("type"))) {
	case "new":
		baseQuery = baseQuery.Where(`NOT EXISTS (
			SELECT 1 FROM orders
			WHERE orders.customer_id = customers.id
			  AND orders.business_id = customers.business_id
			  AND LOWER(orders.payment_status) = 'paid'
			GROUP BY orders.customer_id
			HAVING COUNT(*) > 1
		)`)
	case "returning":
		baseQuery = baseQuery.Where(`EXISTS (
			SELECT 1 FROM orders
			WHERE orders.customer_id = customers.id
			  AND orders.business_id = customers.business_id
			  AND LOWER(orders.payment_status) = 'paid'
			GROUP BY orders.customer_id
			HAVING COUNT(*) > 1
		)`)
	case "", "all":
	default:
		utils.RespondError(c, http.StatusBadRequest, "Filter tipe pelanggan tidak valid.")
		return
	}

	var total int64
	if err := baseQuery.Count(&total).Error; err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Gagal menghitung data pelanggan.")
		return
	}

	var customers []customerSummary
	if total > 0 {
		query := baseQuery.
			Select(`customers.*,
				COALESCE(order_stats.order_count, 0) AS order_count,
				COALESCE(order_stats.lifetime_value_idr, 0) AS lifetime_value_idr,
				order_stats.last_visit AS last_visit`).
			Joins("LEFT JOIN (?) AS order_stats ON order_stats.customer_id = customers.id", customerOrderStatsQuery(businessID)).
			Order("customers.created_at DESC").
			Limit(pageSize).
			Offset((page - 1) * pageSize)
		if err := query.Find(&customers).Error; err != nil {
			utils.RespondError(c, http.StatusInternalServerError, "Gagal mengambil data pelanggan.")
			return
		}
	}

	for i := range customers {
		customers[i].Type = customerType(customers[i].OrderCount)
	}

	stats, err := getCustomerStats(businessID)
	if err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Gagal mengambil ringkasan pelanggan.")
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":      customers,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
		"stats":     stats,
	})
}

func CreateCustomer(c *gin.Context) {
	businessID, ok := getAuthorizedEnterpriseBusiness(c)
	if !ok {
		return
	}

	var input customerInput
	if err := c.ShouldBindJSON(&input); err != nil {
		utils.RespondBindError(c, err)
		return
	}

	input.Name = strings.TrimSpace(input.Name)
	input.Phone = strings.TrimSpace(input.Phone)
	input.Email = strings.TrimSpace(input.Email)
	if input.Name == "" {
		utils.RespondError(c, http.StatusBadRequest, "Nama pelanggan wajib diisi.")
		return
	}

	customer := models.Customer{
		BusinessID: businessID,
		Name:       input.Name,
		Phone:      input.Phone,
		Email:      input.Email,
	}
	if err := config.DB.Create(&customer).Error; err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Gagal membuat profil pelanggan.")
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Profil pelanggan berhasil dibuat.",
		"customer":  customer,
	})
}

func GetCustomer(c *gin.Context) {
	businessID, ok := getAuthorizedEnterpriseBusiness(c)
	if !ok {
		return
	}
	customerID, ok := parseCustomerID(c)
	if !ok {
		return
	}

	customer, err := loadCustomerSummary(businessID, customerID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			utils.RespondError(c, http.StatusNotFound, "Pelanggan tidak ditemukan.")
		} else {
			utils.RespondError(c, http.StatusInternalServerError, "Gagal mengambil profil pelanggan.")
		}
		return
	}

	var orders []models.Order
	if err := config.DB.
		Preload("Items").
		Preload("Items.Product", func(db *gorm.DB) *gorm.DB { return db.Unscoped() }).
		Where("business_id = ? AND customer_id = ?", businessID, customerID).
		Order("created_at DESC").
		Find(&orders).Error; err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Gagal mengambil riwayat pembelian pelanggan.")
		return
	}

	orderHistory := make([]customerOrderResponse, 0, len(orders))
	for _, order := range orders {
		items := make([]customerOrderItemResponse, 0, len(order.Items))
		for _, item := range order.Items {
			items = append(items, customerOrderItemResponse{
				ID:           item.ID,
				ProductID:    item.ProductID,
				ProductName:  item.Product.Name,
				Qty:          item.Qty,
				UnitPriceIDR: item.UnitPriceIDR,
				SubtotalIDR:  item.SubtotalIDR,
			})
		}
		orderHistory = append(orderHistory, customerOrderResponse{
			ID:                order.ID,
			OrderNumber:       order.OrderNumber,
			TotalAmountIDR:    order.TotalAmountIDR,
			DiscountAmountIDR: order.DiscountAmountIDR,
			PaymentMethod:     order.PaymentMethod,
			PaymentStatus:     order.PaymentStatus,
			CreatedAt:         order.CreatedAt,
			Items:             items,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"customer":           customer,
		"purchase_history": orderHistory,
	})
}

func UpdateCustomer(c *gin.Context) {
	businessID, ok := getAuthorizedEnterpriseBusiness(c)
	if !ok {
		return
	}
	customerID, ok := parseCustomerID(c)
	if !ok {
		return
	}

	var input customerInput
	if err := c.ShouldBindJSON(&input); err != nil {
		utils.RespondBindError(c, err)
		return
	}
	input.Name = strings.TrimSpace(input.Name)
	input.Phone = strings.TrimSpace(input.Phone)
	input.Email = strings.TrimSpace(input.Email)
	if input.Name == "" {
		utils.RespondError(c, http.StatusBadRequest, "Nama pelanggan wajib diisi.")
		return
	}

	result := config.DB.Model(&models.Customer{}).
		Where("id = ? AND business_id = ?", customerID, businessID).
		Updates(map[string]interface{}{
			"name":  input.Name,
			"phone": input.Phone,
			"email": input.Email,
		})
	if result.Error != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Gagal memperbarui profil pelanggan.")
		return
	}
	if result.RowsAffected == 0 {
		utils.RespondError(c, http.StatusNotFound, "Pelanggan tidak ditemukan.")
		return
	}

	customer, err := loadCustomerSummary(businessID, customerID)
	if err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Gagal mengambil profil pelanggan.")
		return
	}
	customer.Type = customerType(customer.OrderCount)

	c.JSON(http.StatusOK, gin.H{
		"message": "Profil pelanggan berhasil diperbarui.",
		"customer":  customer,
	})
}

func ArchiveCustomer(c *gin.Context) {
	businessID, ok := getAuthorizedEnterpriseBusiness(c)
	if !ok {
		return
	}
	customerID, ok := parseCustomerID(c)
	if !ok {
		return
	}

	result := config.DB.Where("id = ? AND business_id = ?", customerID, businessID).Delete(&models.Customer{})
	if result.Error != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Gagal mengarsipkan profil pelanggan.")
		return
	}
	if result.RowsAffected == 0 {
		utils.RespondError(c, http.StatusNotFound, "Pelanggan tidak ditemukan.")
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Profil pelanggan berhasil diarsipkan."})
}

func getAuthorizedEnterpriseBusiness(c *gin.Context) (uuid.UUID, bool) {
	userIDValue, exists := c.Get("userID")
	if !exists {
		utils.RespondError(c, http.StatusUnauthorized, "Sesi tidak ditemukan.")
		return uuid.Nil, false
	}
	userID, ok := userIDValue.(uuid.UUID)
	if !ok {
		utils.RespondError(c, http.StatusUnauthorized, "Sesi tidak valid.")
		return uuid.Nil, false
	}

	branchID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		utils.RespondError(c, http.StatusBadRequest, "ID cabang tidak valid.")
		return uuid.Nil, false
	}

	var branch models.Branch
	if err := config.DB.First(&branch, "id = ?", branchID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			utils.RespondError(c, http.StatusNotFound, "Cabang tidak ditemukan.")
		} else {
			utils.RespondError(c, http.StatusInternalServerError, "Gagal memverifikasi cabang.")
		}
		return uuid.Nil, false
	}

	var business models.Business
	if err := config.DB.Where("id = ? AND owner_id = ?", branch.BusinessID, userID).First(&business).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			utils.RespondError(c, http.StatusNotFound, "Cabang tidak ditemukan.")
		} else {
			utils.RespondError(c, http.StatusInternalServerError, "Gagal memverifikasi bisnis.")
		}
		return uuid.Nil, false
	}

	var subscriptions []models.Subscription
	if err := config.DB.Where("business_id = ? AND LOWER(status) = ?", business.ID, "active").Find(&subscriptions).Error; err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Gagal memverifikasi paket bisnis.")
		return uuid.Nil, false
	}

	now := time.Now()
	for _, subscription := range subscriptions {
		if isEnterprisePlan(subscription.PlanID) && (subscription.CurrentPeriodEnd == nil || subscription.CurrentPeriodEnd.After(now)) {
			return business.ID, true
		}
	}

	utils.RespondError(c, http.StatusForbidden, "Fitur pengelolaan pelanggan hanya tersedia untuk paket Enterprise aktif.")
	return uuid.Nil, false
}

func isEnterprisePlan(planID string) bool {
	planID = strings.ToLower(strings.TrimSpace(planID))
	return planID == "enterprise" || planID == "enterprise_monthly" || planID == "enterprise_yearly"
}

func parseCustomerID(c *gin.Context) (uuid.UUID, bool) {
	customerID, err := uuid.Parse(c.Param("customer_id"))
	if err != nil {
		utils.RespondError(c, http.StatusBadRequest, "ID pelanggan tidak valid.")
		return uuid.Nil, false
	}
	return customerID, true
}

func customerPagination(c *gin.Context) (int, int, bool) {
	page := 1
	pageSize := 10

	if value := c.Query("page"); value != "" {
		parsed, err := strconv.Atoi(value)
		if err != nil || parsed < 1 {
			utils.RespondError(c, http.StatusBadRequest, "Nomor halaman harus berupa bilangan positif.")
			return 0, 0, false
		}
		page = parsed
	}
	if value := c.Query("page_size"); value != "" {
		parsed, err := strconv.Atoi(value)
		if err != nil || parsed < 1 || parsed > maxCustomerPageSize {
			utils.RespondError(c, http.StatusBadRequest, "Jumlah data per halaman harus antara 1 sampai 100.")
			return 0, 0, false
		}
		pageSize = parsed
	}
	return page, pageSize, true
}

func customerOrderStatsQuery(businessID uuid.UUID) *gorm.DB {
	return config.DB.Table("orders").
		Select(`customer_id,
			COUNT(*) FILTER (WHERE LOWER(payment_status) = 'paid') AS order_count,
			COALESCE(SUM(total_amount_idr) FILTER (WHERE LOWER(payment_status) = 'paid'), 0) AS lifetime_value_idr,
			MAX(created_at) FILTER (WHERE LOWER(payment_status) = 'paid') AS last_visit`).
		Where("business_id = ? AND customer_id IS NOT NULL", businessID).
		Group("customer_id")
}

func getCustomerStats(businessID uuid.UUID) (customerStats, error) {
	stats := customerStats{}
	err := config.DB.Table("customers").
		Joins("LEFT JOIN (?) AS order_stats ON order_stats.customer_id = customers.id", customerOrderStatsQuery(businessID)).
		Where("customers.business_id = ? AND customers.deleted_at IS NULL", businessID).
		Select(`COUNT(*) AS total_customers,
			COUNT(*) FILTER (WHERE COALESCE(order_stats.order_count, 0) <= 1) AS new_customers,
			COUNT(*) FILTER (WHERE COALESCE(order_stats.order_count, 0) > 1) AS returning_customers,
			COALESCE(SUM(order_stats.lifetime_value_idr), 0) AS lifetime_value_idr`).
		Scan(&stats).Error
	if err != nil {
		return stats, err
	}
	if stats.TotalCustomers > 0 {
		stats.ReturningRate = float64(stats.ReturningCustomers) * 100 / float64(stats.TotalCustomers)
	}
	return stats, nil
}

func loadCustomerSummary(businessID, customerID uuid.UUID) (customerSummary, error) {
	var customer customerSummary
	err := config.DB.Model(&models.Customer{}).
		Select(`customers.*,
			COALESCE(order_stats.order_count, 0) AS order_count,
			COALESCE(order_stats.lifetime_value_idr, 0) AS lifetime_value_idr,
			order_stats.last_visit AS last_visit`).
		Joins("LEFT JOIN (?) AS order_stats ON order_stats.customer_id = customers.id", customerOrderStatsQuery(businessID)).
		Where("customers.business_id = ? AND customers.id = ?", businessID, customerID).
		First(&customer).Error
	if err == nil {
		customer.Type = customerType(customer.OrderCount)
	}
	return customer, err
}

func customerType(orderCount int64) string {
	if orderCount > 1 {
		return "Returning"
	}
	return "New"
}
