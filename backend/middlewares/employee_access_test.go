package middlewares

import (
	"net/http"
	"testing"
)

func TestEmployeeRolePermissions(t *testing.T) {
	tests := []struct {
		name   string
		role   string
		method string
		route  string
		want   bool
	}{
		{"cashier can use POS catalog", "Kasir", http.MethodGet, "/api/branches/:id/products", true},
		{"cashier cannot edit products", "cashier", http.MethodPut, "/api/branches/:id/products/:product_id", false},
		{"cashier can submit orders", "cashier", http.MethodPost, "/api/branches/:id/orders", true},
		{"cashier can load customer vouchers", "cashier", http.MethodGet, "/api/branches/:id/customers/:customer_id/vouchers", true},
		{"cashier cannot view inventory movements", "cashier", http.MethodGet, "/api/branches/:id/movements", false},
		{"warehouse can adjust stock", "Staf Gudang", http.MethodPost, "/api/branches/:id/products/:product_id/movement", true},
		{"warehouse can edit products", "warehouse_staff", http.MethodPut, "/api/branches/:id/products/:product_id", true},
		{"warehouse cannot submit orders", "warehouse_staff", http.MethodPost, "/api/branches/:id/orders", false},
		{"manager can manage customers", "Manajer Toko", http.MethodPut, "/api/branches/:id/customers/:customer_id", true},
		{"english manager label can manage customers", "Manager Toko", http.MethodGet, "/api/branches/:id/customers", true},
		{"manager can manage employees", "manager", http.MethodPost, "/api/branches/:id/employees", true},
		{"manager can record attendance", "manager", http.MethodPost, "/api/branches/:id/employees/:employee_id/attendance/clock-in", true},
		{"manager cannot access POS", "manager", http.MethodPost, "/api/branches/:id/orders", false},
		{"unknown roles have no access", "Admin", http.MethodGet, "/api/branches/:id/products", false},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := employeeRoleAllows(test.role, test.method, test.route); got != test.want {
				t.Errorf("employeeRoleAllows(%q, %q, %q) = %t, want %t", test.role, test.method, test.route, got, test.want)
			}
		})
	}
}
