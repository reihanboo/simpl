package middlewares

import (
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
			(route == "/api/branches/:id/products/:product_id" && method == http.MethodDelete) ||
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
