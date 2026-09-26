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
	)
	if err != nil {
		log.Fatalf("Failed to auto migrate: %v", err)
	}

	DB = db
	log.Println("Database connected & models migrated.")
}
