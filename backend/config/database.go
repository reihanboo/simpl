package config

import (
	"fmt"
	"log"
	"os"

	"backend/models"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var DB *gorm.DB

func ConnectDB() {
	host := os.Getenv("DB_HOST")
	user := os.Getenv("DB_USER")
	password := os.Getenv("DB_PASSWORD")
	dbname := os.Getenv("DB_NAME")
	port := os.Getenv("DB_PORT")

	// 1. First connect to the default "postgres" database to create our target database if it doesn't exist
	defaultDsn := fmt.Sprintf("host=%s user=%s password=%s dbname=postgres port=%s sslmode=disable TimeZone=Asia/Jakarta",
		host, user, password, port)

	defaultDb, err := gorm.Open(postgres.Open(defaultDsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to postgres server: %v", err)
	}

	var count int64
	defaultDb.Raw("SELECT count(*) FROM pg_database WHERE datname = ?", dbname).Scan(&count)
	if count == 0 {
		log.Printf("Database %s does not exist. Creating it now...", dbname)
		defaultDb.Exec(fmt.Sprintf("CREATE DATABASE %s;", dbname))
	} else {
		log.Printf("Database %s already exists.", dbname)
	}

	// 2. Now connect to the actual target database
	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=disable TimeZone=Asia/Jakarta",
		host, user, password, dbname, port)

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to database %s: %v", dbname, err)
	}

	// Auto Migrate (Creates tables if they do not exist)
	err = db.AutoMigrate(
		&models.User{},
		&models.Business{},
		&models.Subscription{},
		&models.Branch{},
		&models.Product{},
		&models.BranchInventory{},
		&models.StockMovement{},
		&models.Customer{},
		&models.LoyaltyReward{},
		&models.LoyaltyRewardCustomer{},
		&models.LoyaltyPointLog{},
		&models.Order{},
		&models.OrderItem{},
	)
	if err != nil {
		log.Fatalf("Failed to auto migrate: %v", err)
	}

	// Older installations may still have the pre-rename amount column.
	var hasLegacyOrderAmountColumn bool
	if err := db.Raw(`
		SELECT EXISTS (
			SELECT 1 FROM information_schema.columns
			WHERE table_schema = current_schema()
			  AND table_name = 'orders'
			  AND column_name = 'total_amount_id_r'
		)
	`).Scan(&hasLegacyOrderAmountColumn).Error; err != nil {
		log.Fatalf("Failed to inspect legacy order total column: %v", err)
	}
	if hasLegacyOrderAmountColumn {
		if err := db.Exec(`
			UPDATE orders
			SET total_amount_idr = total_amount_id_r
			WHERE total_amount_id_r IS NOT NULL
			  AND (total_amount_idr IS NULL OR total_amount_idr = 0)
		`).Error; err != nil {
			log.Fatalf("Failed to migrate legacy order totals: %v", err)
		}
		if err := db.Exec("ALTER TABLE orders ALTER COLUMN total_amount_id_r DROP NOT NULL").Error; err != nil {
			log.Fatalf("Failed to update legacy order total constraint: %v", err)
		}
	}

	DB = db
	log.Println("Database connected & models migrated.")
}
