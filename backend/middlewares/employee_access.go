package middlewares

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"strings"

	"backend/config"
	"backend/models"
	"backend/utils"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// EmployeeBranchAccessMiddleware binds employee accounts to their assigned
// branch and limits every branch API request to the routes allowed by role.
func EmployeeBranchAccessMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, ok := authenticatedUserID(c)
		if !ok {
			return
		}

		var employee models.Employee
		err := config.DB.Unscoped().Where("user_id = ?", userID).First(&employee).Error
		if err != nil {
			if err == gorm.ErrRecordNotFound {
				if !authorizeBusinessBranchRequest(c, userID) {
					return
				}
				c.Next()
				return
			}
			utils.RespondError(c, http.StatusInternalServerError, "Gagal memverifikasi akses pegawai.")
			c.Abort()
			return
		}

		if employee.DeletedAt.Valid || employee.Status != "Aktif" {
			utils.RespondError(c, http.StatusForbidden, "Akun pegawai tidak aktif.")
			c.Abort()
			return
		}

		requestedBranchID, err := uuid.Parse(c.Param("id"))
		if err != nil || requestedBranchID != employee.BranchID {
			utils.RespondError(c, http.StatusForbidden, "Akun hanya dapat mengakses cabang yang ditugaskan.")
			c.Abort()
			return
		}

		if !employeeRoleAllows(employee.Role, c.Request.Method, c.FullPath()) {
			utils.RespondError(c, http.StatusForbidden, "Peran Anda tidak memiliki akses ke fitur ini.")
			c.Abort()
			return
		}

		c.Set("employeeID", employee.ID)
		c.Set("employeeRole", normalizeRole(employee.Role))
		c.Set("employeeBranchID", employee.BranchID)
		c.Next()
	}
}

// authorizeBusinessBranchRequest validates both branch-scoped APIs and the
// branch collection endpoints, which otherwise have no branch ID in the URL.
func authorizeBusinessBranchRequest(c *gin.Context, userID uuid.UUID) bool {
	var businessID uuid.UUID

	if branchID := c.Param("id"); branchID != "" {
		parsedBranchID, err := uuid.Parse(branchID)
		if err != nil {
			utils.RespondError(c, http.StatusBadRequest, "ID cabang tidak valid.")
			c.Abort()
			return false
		}
		var branch models.Branch
		if err := config.DB.Select("business_id").First(&branch, "id = ?", parsedBranchID).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				utils.RespondError(c, http.StatusNotFound, "Cabang tidak ditemukan.")
			} else {
				utils.RespondError(c, http.StatusInternalServerError, "Gagal memverifikasi akses cabang.")
			}
			c.Abort()
			return false
		}
		businessID = branch.BusinessID
	} else {
		var rawBusinessID string
		switch c.Request.Method {
		case http.MethodGet:
			rawBusinessID = c.Query("business_id")
		case http.MethodPost:
			body, err := io.ReadAll(io.LimitReader(c.Request.Body, 1<<20))
			if err != nil {
				utils.RespondError(c, http.StatusBadRequest, "Data yang diberikan tidak valid.")
				c.Abort()
				return false
			}
			c.Request.Body = io.NopCloser(bytes.NewReader(body))
			var payload struct {
				BusinessID string `json:"business_id"`
			}
			if err := json.Unmarshal(body, &payload); err != nil {
				utils.RespondError(c, http.StatusBadRequest, "Data yang diberikan tidak valid.")
				c.Abort()
				return false
			}
			rawBusinessID = payload.BusinessID
		default:
			utils.RespondError(c, http.StatusForbidden, "Akses bisnis tidak diizinkan.")
			c.Abort()
			return false
		}
		parsedBusinessID, err := uuid.Parse(rawBusinessID)
		if err != nil {
			utils.RespondError(c, http.StatusBadRequest, "ID bisnis tidak valid.")
			c.Abort()
			return false
		}
		businessID = parsedBusinessID
	}

	var count int64
	if err := config.DB.Model(&models.Business{}).
		Where("id = ? AND (owner_id = ? OR EXISTS (SELECT 1 FROM business_members WHERE business_members.business_id = businesses.id AND business_members.user_id = ?))", businessID, userID, userID).
		Count(&count).Error; err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Gagal memverifikasi akses bisnis.")
		c.Abort()
		return false
	}
	if count == 0 {
		utils.RespondError(c, http.StatusForbidden, "Anda tidak memiliki akses ke cabang ini.")
		c.Abort()
		return false
	}

	c.Set("authorizedBusinessID", businessID)
	return true
}

// EmployeeBusinessAccessMiddleware permits staff to read their assigned
// business for the dashboard shell, but denies business administration APIs.
func EmployeeBusinessAccessMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, ok := authenticatedUserID(c)
		if !ok {
			return
		}
		var employee models.Employee
		err := config.DB.Unscoped().Where("user_id = ?", userID).First(&employee).Error
		if err == gorm.ErrRecordNotFound {
			c.Next()
			return
		}
		if err != nil {
			utils.RespondError(c, http.StatusInternalServerError, "Gagal memverifikasi akun pegawai.")
			c.Abort()
			return
		}
		if employee.DeletedAt.Valid || employee.Status != "Aktif" {
			utils.RespondError(c, http.StatusForbidden, "Akun pegawai tidak aktif.")
			c.Abort()
			return
		}
		if c.Request.Method != http.MethodGet || c.FullPath() != "/api/business" {
			utils.RespondError(c, http.StatusForbidden, "Akun pegawai tidak dapat mengelola pengaturan bisnis.")
			c.Abort()
			return
		}
		c.Next()
	}
}

func authenticatedUserID(c *gin.Context) (uuid.UUID, bool) {
	value, exists := c.Get("userID")
	userID, valid := value.(uuid.UUID)
	if !exists || !valid {
		utils.RespondError(c, http.StatusUnauthorized, "Sesi Anda tidak valid. Silakan masuk kembali.")
		c.Abort()
		return uuid.Nil, false
	}
	return userID, true
}

func normalizeRole(role string) string {
	switch strings.ToLower(strings.TrimSpace(role)) {
	case "kasir", "cashier":
		return "cashier"
	case "staf gudang", "warehouse staff", "warehouse_staff", "warehouse":
		return "warehouse_staff"
	case "manajer toko", "manager toko", "manager", "manajer", "store manager":
		return "manager"
	default:
		return ""
	}
}

func employeeRoleAllows(role, method, route string) bool {
	role = normalizeRole(role)
	switch role {
	case "cashier":
		return (route == "/api/branches/:id/products" && method == http.MethodGet) ||
			(route == "/api/branches/:id/orders" && method == http.MethodPost) ||
			(route == "/api/branches/:id/reports/sales" && method == http.MethodGet) ||
			(route == "/api/branches/:id/customers" && (method == http.MethodGet || method == http.MethodPost))
	case "warehouse_staff":
		return (route == "/api/branches/:id/products" && (method == http.MethodGet || method == http.MethodPost)) ||
			(route == "/api/branches/:id/products/:product_id" && (method == http.MethodPut || method == http.MethodDelete)) ||
			(route == "/api/branches/:id/products/:product_id/movement" && method == http.MethodPost) ||
			(route == "/api/branches/:id/movements" && method == http.MethodGet) ||
			((route == "/api/branches/:id/forecast" || route == "/api/branches/:id/forecast/series") && method == http.MethodGet)
	case "manager":
		return strings.HasPrefix(route, "/api/branches/:id/customers") ||
			strings.HasPrefix(route, "/api/branches/:id/loyalty-rewards") ||
			(route == "/api/branches/:id/employees" && (method == http.MethodGet || method == http.MethodPost)) ||
			(route == "/api/branches/:id/employees/:employee_id" && (method == http.MethodPut || method == http.MethodDelete)) ||
			(strings.HasPrefix(route, "/api/branches/:id/employees/:employee_id/attendance/") && method == http.MethodPost)
	default:
		return false
	}
}
