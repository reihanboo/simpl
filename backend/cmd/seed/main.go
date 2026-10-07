package main

import (
	"fmt"
	"log"
	"os"
	"time"

	_ "time/tzdata"

	"backend/config"
	"backend/models"

	"github.com/google/uuid"
	"github.com/joho/godotenv"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

						const (
	demoPassword             = "SIMPLdemo123!"
	demoEnterpriseOrderCount = 540
	demoUMKMOrderCount       = 270
	demoSalesHistoryDays     = 90
)

func main() {
	_ = godotenv.Load("../.env", ".env")
	if os.Getenv("DB_HOST") == "" {
		log.Fatal("DB_HOST is not set. Configure the database environment before seeding.")
	}

	config.ConnectDB()
	if err := seed(config.DB); err != nil {
		log.Fatalf("Could not seed demo data: %v", err)
	}

	fmt.Println("Demo data is ready.")
	fmt.Println("Owner login: demo.owner@simpl.test / " + demoPassword)
	fmt.Println("Employee logins: demo.manager@simpl.test, demo.cashier@simpl.test, demo.warehouse@simpl.test / " + demoPassword)
	fmt.Println("Co-owner login: demo.coowner@simpl.test / " + demoPassword)
	fmt.Println("Pending invite login: demo.invited@simpl.test / " + demoPassword)
}

func seed(db *gorm.DB) error {
	passwordHash, err := bcrypt.GenerateFromPassword([]byte(demoPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	ids := map[string]uuid.UUID{}
	newID := func(key string) uuid.UUID {
		id := uuid.NewSHA1(uuid.NameSpaceURL, []byte("simpl-demo:"+key))
		ids[key] = id
		return id
	}
	return db.Transaction(func(tx *gorm.DB) error {
		upsert := func(value any) error {
			return tx.Clauses(clause.OnConflict{UpdateAll: true}).Create(value).Error
		}
		users := []models.User{
			{ID: newID("user:owner"), Email: "demo.owner@simpl.test", Phone: "+6281200000001", Username: "demo_owner", PasswordHash: string(passwordHash), IsVerified: true},
			{ID: newID("user:coowner"), Email: "demo.coowner@simpl.test", Phone: "+6281200000002", Username: "demo_coowner", PasswordHash: string(passwordHash), IsVerified: true},
			{ID: newID("user:invited"), Email: "demo.invited@simpl.test", Phone: "+6281200000003", Username: "demo_invited", PasswordHash: string(passwordHash), IsVerified: true},
			{ID: newID("user:manager"), Email: "demo.manager@simpl.test", Phone: "+6281200000010", Username: "staff_demo_manager", PasswordHash: string(passwordHash), IsVerified: true},
			{ID: newID("user:cashier"), Email: "demo.cashier@simpl.test", Phone: "+6281200000011", Username: "staff_demo_cashier", PasswordHash: string(passwordHash), IsVerified: true},
			{ID: newID("user:warehouse"), Email: "demo.warehouse@simpl.test", Phone: "+6281200000012", Username: "staff_demo_warehouse", PasswordHash: string(passwordHash), IsVerified: true},
		}
		for i := range users {
			if err := upsert(&users[i]); err != nil {
				return fmt.Errorf("upsert user %s: %w", users[i].Email, err)
			}
		}

		now := time.Now().UTC()
		ownerID := ids["user:owner"]
		enterprise := models.Business{ID: newID("business:enterprise"), OwnerID: ownerID, Name: "Kopi Senja Demo - Enterprise", Address: "Jl. Kemang Raya No. 12, Jakarta Selatan"}
		umkm := models.Business{ID: newID("business:umkm"), OwnerID: ownerID, Name: "Roti Pagi Demo - UMKM", Address: "Jl. Tebet Barat No. 8, Jakarta Selatan"}
		for _, business := range []models.Business{enterprise, umkm} {
			if err := upsert(&business); err != nil {
				return fmt.Errorf("upsert business %s: %w", business.Name, err)
			}
		}

		enterpriseEnd := now.AddDate(0, 1, 0)
		umkmEnd := now.AddDate(0, 1, 0)
		for _, subscription := range []models.Subscription{
			{ID: newID("subscription:enterprise"), BusinessID: enterprise.ID, PlanID: "Enterprise", Status: "active", DurationMonths: 1, CurrentPeriodEnd: &enterpriseEnd},
			{ID: newID("subscription:umkm"), BusinessID: umkm.ID, PlanID: "UMKM", Status: "active", DurationMonths: 1, CurrentPeriodEnd: &umkmEnd},
		} {
			if err := upsert(&subscription); err != nil {
				return fmt.Errorf("upsert subscription: %w", err)
			}
		}

		branches := []models.Branch{
			{ID: newID("branch:enterprise:kemang"), BusinessID: enterprise.ID, Name: "Kopi Senja - Kemang", Address: "Jl. Kemang Raya No. 12, Jakarta Selatan", Latitude: float64Ptr(-6.2608), Longitude: float64Ptr(106.8106), GeofenceRadiusM: 250, Timezone: "Asia/Jakarta"},
			{ID: newID("branch:enterprise:blokm"), BusinessID: enterprise.ID, Name: "Kopi Senja - Blok M", Address: "Blok M Square, Jakarta Selatan", Latitude: float64Ptr(-6.2441), Longitude: float64Ptr(106.7996), GeofenceRadiusM: 250, Timezone: "Asia/Jakarta"},
			{ID: newID("branch:umkm:tebet"), BusinessID: umkm.ID, Name: "Roti Pagi - Tebet", Address: "Jl. Tebet Barat No. 8, Jakarta Selatan", Latitude: float64Ptr(-6.2267), Longitude: float64Ptr(106.8505), GeofenceRadiusM: 250, Timezone: "Asia/Jakarta"},
		}
		for i := range branches {
			if err := upsert(&branches[i]); err != nil {
				return fmt.Errorf("upsert branch %s: %w", branches[i].Name, err)
			}
		}
		branchA, branchB, branchUMKM := branches[0], branches[1], branches[2]

		member := models.BusinessMember{BusinessID: enterprise.ID, UserID: ids["user:coowner"], Role: "co_owner"}
		if err := upsert(&member); err != nil {
			return fmt.Errorf("upsert co-owner membership: %w", err)
		}
		invitation := models.BusinessInvitation{ID: newID("invitation:pending"), BusinessID: enterprise.ID, Email: "demo.invited@simpl.test", InvitedByID: ownerID, Status: "pending"}
		if err := upsert(&invitation); err != nil {
			return fmt.Errorf("upsert pending invitation: %w", err)
		}

		employees := []models.Employee{
			{ID: newID("employee:manager"), BusinessID: enterprise.ID, BranchID: branchA.ID, Name: "Maya Putri", Email: "demo.manager@simpl.test", Phone: "+6281200000010", Role: "Manajer Toko", UserID: uuidPtr(ids["user:manager"]), Status: "Aktif", Shift: "09:00 - 17:00"},
			{ID: newID("employee:cashier"), BusinessID: enterprise.ID, BranchID: branchA.ID, Name: "Rizky Pratama", Email: "demo.cashier@simpl.test", Phone: "+6281200000011", Role: "Kasir", UserID: uuidPtr(ids["user:cashier"]), Status: "Aktif", Shift: "08:00 - 16:00"},
			{ID: newID("employee:warehouse"), BusinessID: enterprise.ID, BranchID: branchA.ID, Name: "Siti Rahma", Email: "demo.warehouse@simpl.test", Phone: "+6281200000012", Role: "Staf Gudang", UserID: uuidPtr(ids["user:warehouse"]), Status: "Aktif", Shift: "10:00 - 18:00"},
			{ID: newID("employee:barista"), BusinessID: enterprise.ID, BranchID: branchB.ID, Name: "Dimas Saputra", Email: "dimas@simpl.test", Phone: "+6281200000013", Role: "Kasir", Status: "Aktif", Shift: "07:00 - 15:00"},
			{ID: newID("employee:leave"), BusinessID: enterprise.ID, BranchID: branchA.ID, Name: "Nadia Lestari", Email: "nadia@simpl.test", Phone: "+6281200000014", Role: "Staf Gudang", Status: "Cuti", Shift: "09:00 - 17:00"},
		}
		for i := range employees {
			if err := upsert(&employees[i]); err != nil {
				return fmt.Errorf("upsert employee %s: %w", employees[i].Name, err)
			}
		}

		products, err := seedProducts(upsert, newID, enterprise.ID, umkm.ID)
		if err != nil {
			return err
		}
		customers, err := seedCustomers(upsert, newID, enterprise.ID, now)
		if err != nil {
			return err
		}
		if err := seedOrdersAndInventory(upsert, newID, now, ownerID, ids["user:cashier"], enterprise.ID, []models.Branch{branchA, branchB}, products[enterprise.ID], customers, demoEnterpriseOrderCount); err != nil {
			return err
		}
		if err := seedOrdersAndInventory(upsert, newID, now, ownerID, ownerID, umkm.ID, []models.Branch{branchUMKM}, products[umkm.ID], nil, demoUMKMOrderCount); err != nil {
			return err
		}
		if err := seedAttendance(upsert, newID, now, enterprise.ID, branchA.ID, employees[:3]); err != nil {
			return err
		}
		if err := seedLoyalty(upsert, newID, enterprise.ID, customers, ownerID, now); err != nil {
			return err
		}

		chatLogs := []models.AIChatLog{
			{ID: newID("ai-log:1"), BusinessID: enterprise.ID, BranchID: branchA.ID, UserID: ownerID, UserQuery: "Produk apa yang paling laris bulan ini?", GeneratedSQL: `[{"tool":"get_sales_report","period":"this_month"}]`, CreatedAt: now.Add(-2 * time.Hour)},
			{ID: newID("ai-log:2"), BusinessID: enterprise.ID, BranchID: branchA.ID, UserID: ownerID, UserQuery: "Stok apa yang perlu segera di-restock?", GeneratedSQL: `[{"tool":"get_inventory_report","filter":"low_stock"}]`, CreatedAt: now.Add(-time.Hour)},
		}
		for i := range chatLogs {
			if err := upsert(&chatLogs[i]); err != nil {
				return fmt.Errorf("upsert AI chat history: %w", err)
			}
		}
		return nil
	})
}

func seedProducts(upsert func(any) error, newID func(string) uuid.UUID, enterpriseID, umkmID uuid.UUID) (map[uuid.UUID][]models.Product, error) {
	catalog := []struct {
		Name, SKU        string
		Cost, Price      int64
		Threshold, Stock int
	}{
		{"Kopi Susu Senja", "KOPI-001", 14000, 28000, 10, 62},
		{"Americano", "KOPI-002", 10000, 22000, 8, 9},
		{"Cafe Latte", "KOPI-003", 13000, 27000, 8, 34},
		{"Matcha Latte", "KOPI-004", 16000, 32000, 8, 7},
		{"Croissant Butter", "FOOD-001", 9000, 19000, 10, 28},
		{"Pisang Roti", "FOOD-002", 7000, 15000, 10, 41},
		{"Cold Brew", "KOPI-005", 12000, 26000, 8, 0},
		{"Air Mineral", "DRINK-001", 3000, 7000, 12, 55},
	}
	result := map[uuid.UUID][]models.Product{enterpriseID: {}, umkmID: {}}
	for _, businessID := range []uuid.UUID{enterpriseID, umkmID} {
		for _, item := range catalog {
			product := models.Product{ID: newID(fmt.Sprintf("product:%s:%s", businessID, item.SKU)), BusinessID: businessID, Name: item.Name, SKU: item.SKU, CostPriceIDR: item.Cost, SellingPriceIDR: item.Price, LowStockThreshold: item.Threshold}
			if err := upsert(&product); err != nil {
				return nil, fmt.Errorf("upsert product %s: %w", item.Name, err)
			}
			result[businessID] = append(result[businessID], product)
		}
	}
	return result, nil
}

func seedCustomers(upsert func(any) error, newID func(string) uuid.UUID, businessID uuid.UUID, now time.Time) ([]models.Customer, error) {
	names := []string{"Aulia Ramadhan", "Budi Santoso", "Citra Maharani", "Dewi Anggraini", "Eko Prasetyo", "Farah Nabila", "Gilang Putra", "Hana Safitri", "Indra Wijaya", "Jihan Permata", "Kevin Hartono", "Larasati Putri"}
	customers := make([]models.Customer, 0, len(names))
	for i, name := range names {
		customer := models.Customer{ID: newID(fmt.Sprintf("customer:%s:%02d", businessID, i+1)), BusinessID: businessID, Name: name, Phone: fmt.Sprintf("+62813%07d", 1000000+i), Email: fmt.Sprintf("pelanggan%02d@simpl.test", i+1), LoyaltyPoints: []int{480, 220, 95, 710, 340, 120, 560, 65, 290, 180, 840, 30}[i], MembershipActive: i != 10, CreatedAt: now.AddDate(0, 0, -(90 - i*3))}
		if err := upsert(&customer); err != nil {
			return nil, fmt.Errorf("upsert customer %s: %w", name, err)
		}
		customers = append(customers, customer)
	}
	return customers, nil
}

func seedOrdersAndInventory(upsert func(any) error, newID func(string) uuid.UUID, now time.Time, ownerID, cashierID, businessID uuid.UUID, branches []models.Branch, products []models.Product, customers []models.Customer, orderCount int) error {
	methods := []string{"cash", "qris", "debit", "ewallet", "transfer"}
	soldByBranchProduct := map[string]int{}
	for i := 0; i < orderCount; i++ {
		branch := branches[i%len(branches)]
		customerID := (*uuid.UUID)(nil)
		if len(customers) > 0 {
			customerIndex := ((i % len(customers)) * 5) % len(customers)
			id := customers[customerIndex].ID
			customerID = &id
		}
		created := demoOrderTime(now, i, orderCount)
		order := models.Order{ID: newID(fmt.Sprintf("order:%s:%03d", businessID, i+1)), BusinessID: businessID, BranchID: branch.ID, CashierID: cashierID, CustomerID: customerID, OrderNumber: fmt.Sprintf("DEMO-%s-%03d", shortPlanKey(branches), i+1), TotalAmountIDR: 0, PaymentMethod: methods[i%len(methods)], PaymentStatus: "paid", CreatedAt: created}
		orderTotal := int64(0)
		itemCount := 1 + (i % 3)
		for j := 0; j < itemCount; j++ {
			product := products[(i*3+j*2)%len(products)]
			qty := 1 + ((i + j) % 3)
			unit := product.SellingPriceIDR
			item := models.OrderItem{ID: newID(fmt.Sprintf("order-item:%s:%03d:%d", businessID, i+1, j+1)), OrderID: order.ID, ProductID: product.ID, Qty: qty, UnitPriceIDR: unit, SubtotalIDR: unit * int64(qty)}
			order.Items = append(order.Items, item)
			orderTotal += item.SubtotalIDR
			soldByBranchProduct[branch.ID.String()+":"+product.ID.String()] += qty
		}
		order.TotalAmountIDR = orderTotal
		if err := upsert(&order); err != nil {
			return fmt.Errorf("upsert order %s: %w", order.OrderNumber, err)
		}
		for i := range order.Items {
			if err := upsert(&order.Items[i]); err != nil {
				return fmt.Errorf("upsert order item for %s: %w", order.OrderNumber, err)
			}
		}
	}

	for branchIndex, branch := range branches {
		for productIndex, product := range products {
			sold := soldByBranchProduct[branch.ID.String()+":"+product.ID.String()]
			stock := []int{62, 9, 34, 7, 28, 41, 0, 55}[productIndex]
			if branchIndex > 0 {
				stock = max(0, stock/2+branchIndex*3)
			}
			initialStock := stock + sold
			inventory := models.BranchInventory{ID: newID(fmt.Sprintf("inventory:%s:%s", branch.ID, product.ID)), BranchID: branch.ID, ProductID: product.ID, CurrentStock: stock, UpdatedAt: now}
			if err := upsert(&inventory); err != nil {
				return fmt.Errorf("upsert inventory for %s: %w", product.Name, err)
			}
			adjustment := models.StockMovement{ID: newID(fmt.Sprintf("movement:initial:%s:%s", branch.ID, product.ID)), BranchID: branch.ID, ProductID: product.ID, UserID: ownerID, QtyChange: initialStock, Reason: "adjustment", CreatedAt: jakartaTime(now, demoSalesHistoryDays+1, 8)}
			if err := upsert(&adjustment); err != nil {
				return fmt.Errorf("upsert opening stock movement: %w", err)
			}
			for orderIndex := 0; orderIndex < orderCount; orderIndex++ {
				orderBranch := branches[orderIndex%len(branches)]
				if orderBranch.ID != branch.ID {
					continue
				}
				itemCount := 1 + (orderIndex % 3)
				for itemIndex := 0; itemIndex < itemCount; itemIndex++ {
					if products[(orderIndex*3+itemIndex*2)%len(products)].ID != product.ID {
						continue
					}
					qty := 1 + ((orderIndex + itemIndex) % 3)
					movement := models.StockMovement{ID: newID(fmt.Sprintf("movement:sale:%s:%03d:%d", businessID, orderIndex+1, itemIndex+1)), BranchID: branch.ID, ProductID: product.ID, UserID: cashierID, QtyChange: -qty, Reason: "sale", CreatedAt: demoOrderTime(now, orderIndex, orderCount)}
					if err := upsert(&movement); err != nil {
						return fmt.Errorf("upsert sale stock movement: %w", err)
					}
				}
			}
		}
	}
	return nil
}

func seedAttendance(upsert func(any) error, newID func(string) uuid.UUID, now time.Time, businessID, branchID uuid.UUID, employees []models.Employee) error {
	location, err := time.LoadLocation("Asia/Jakarta")
	if err != nil {
		return err
	}
	for day := 13; day >= 0; day-- {
		localDay := now.In(location).AddDate(0, 0, -day)
		date := localDay.Format("2006-01-02")
		for employeeIndex, employee := range employees {
			clockIn := time.Date(localDay.Year(), localDay.Month(), localDay.Day(), 8+employeeIndex, employeeIndex*4, 0, 0, location)
			clockOut := clockIn.Add(8*time.Hour + 5*time.Minute)
			status := "Tepat Waktu"
			if (day+employeeIndex)%5 == 0 {
				status = "Terlambat"
				clockIn = clockIn.Add(17 * time.Minute)
			}
			attendance := models.EmployeeAttendance{ID: newID("attendance:" + employee.ID.String() + ":" + date), BusinessID: businessID, BranchID: branchID, EmployeeID: employee.ID, AttendanceDate: date, ClockIn: &clockIn, ClockOut: &clockOut, ClockInLatitude: float64Ptr(-6.2608), ClockInLongitude: float64Ptr(106.8106), ClockInAccuracyM: float64Ptr(12), ClockOutLatitude: float64Ptr(-6.2608), ClockOutLongitude: float64Ptr(106.8106), ClockOutAccuracyM: float64Ptr(15), Status: status}
			if err := upsert(&attendance); err != nil {
				return fmt.Errorf("upsert attendance for %s on %s: %w", employee.Name, date, err)
			}
		}
	}
	return nil
}

func seedLoyalty(upsert func(any) error, newID func(string) uuid.UUID, businessID uuid.UUID, customers []models.Customer, ownerID uuid.UUID, now time.Time) error {
	starts, ends := now.AddDate(0, 0, -30), now.AddDate(0, 1, 0)
	maxDiscount := int64(50000)
	usageLimit, customerLimit := 200, 1
	rewards := []models.LoyaltyReward{
		{ID: newID("reward:free-drink"), BusinessID: businessID, Name: "Gratis 1 Minuman", Description: "Tukar poin dengan minuman pilihan.", TermsAndConditions: "Berlaku untuk satu transaksi.", PointsRequired: 300, DiscountType: "fixed", DiscountAmountIDR: 28000, UsageLimit: &usageLimit, PerCustomerLimit: &customerLimit, StartsAt: &starts, EndsAt: &ends, IsActive: true},
		{ID: newID("reward:ten-percent"), BusinessID: businessID, Name: "Diskon 10%", Description: "Diskon untuk pelanggan setia.", TermsAndConditions: "Maksimal potongan Rp 50.000.", PointsRequired: 500, DiscountType: "percentage", DiscountPercentage: 10, MaxDiscountAmountIDR: &maxDiscount, IsActive: true},
	}
	for i := range rewards {
		if err := upsert(&rewards[i]); err != nil {
			return fmt.Errorf("upsert loyalty reward: %w", err)
		}
	}
	for i, customer := range customers {
		logEntry := models.LoyaltyPointLog{ID: newID("points-log:" + customer.ID.String()), BusinessID: uuidPtr(businessID), CustomerID: customer.ID, ActorUserID: uuidPtr(ownerID), PointsChanged: customer.LoyaltyPoints, PointsBalanceAfter: intPtr(customer.LoyaltyPoints), Reason: "Poin dari transaksi demo", Type: "earn", CreatedAt: now.AddDate(0, 0, -(i + 1))}
		if err := upsert(&logEntry); err != nil {
			return fmt.Errorf("upsert loyalty point history: %w", err)
		}
		if i < 4 {
			link := models.LoyaltyRewardCustomer{RewardID: rewards[i%len(rewards)].ID, CustomerID: customer.ID}
			if err := upsert(&link); err != nil {
				return fmt.Errorf("upsert targeted reward: %w", err)
			}
		}
	}
	return nil
}

func shortPlanKey(branches []models.Branch) string {
	if len(branches) == 1 {
		return "UMKM"
	}
	return "ENT"
}

func demoOrderTime(now time.Time, orderIndex, orderCount int) time.Time {
	daysAgo := (orderCount - 1 - orderIndex) * demoSalesHistoryDays / orderCount
	hour := 8 + (orderIndex*5)%14
	minute := (orderIndex * 17) % 60
	created := jakartaTime(now, daysAgo, hour).Add(time.Duration(minute) * time.Minute)
	localNow := now.In(created.Location())
	if created.After(localNow) {
		return localNow.Add(-time.Duration(orderCount-orderIndex) * time.Minute)
	}
	return created
}

func jakartaTime(now time.Time, daysAgo, hour int) time.Time {
	location, err := time.LoadLocation("Asia/Jakarta")
	if err != nil {
		location = time.FixedZone("WIB", 7*60*60)
	}
	localDay := now.In(location).AddDate(0, 0, -daysAgo)
	return time.Date(localDay.Year(), localDay.Month(), localDay.Day(), hour, 0, 0, 0, location)
}

func float64Ptr(value float64) *float64  { return &value }
func intPtr(value int) *int              { return &value }
func uuidPtr(value uuid.UUID) *uuid.UUID { return &value }
