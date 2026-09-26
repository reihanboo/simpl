package main

import (
	"log"
	"net/http"
	"os"

	"backend/config"
	"backend/controllers"
	"backend/middlewares"
	"backend/utils"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	// Load .env file if it exists (for local development)
	_ = godotenv.Load()

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// Connect to Database
	config.ConnectDB()

	r := gin.New()
	r.Use(gin.Logger(), middlewares.ErrorRecovery())
	r.NoRoute(func(c *gin.Context) {
		utils.RespondError(c, http.StatusNotFound, "Endpoint yang Anda cari tidak ditemukan.")
	})
	r.NoMethod(func(c *gin.Context) {
		utils.RespondError(c, http.StatusMethodNotAllowed, "Metode permintaan ini tidak didukung untuk endpoint tersebut.")
	})
	r.HandleMethodNotAllowed = true

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status": "OK",
		})
	})

	api := r.Group("/api")
	{
		auth := api.Group("/auth")
		{
			auth.POST("/register", controllers.Register)
			auth.POST("/verify-otp", controllers.VerifyOTP)
			auth.POST("/resend-otp", controllers.ResendOTP)
			auth.POST("/login", controllers.Login)
			auth.POST("/forgot-password", controllers.ForgotPassword)
			auth.POST("/reset-password", controllers.ResetPassword)
			auth.GET("/me", middlewares.AuthMiddleware(), controllers.Me)
			auth.PUT("/me", middlewares.AuthMiddleware(), controllers.UpdateProfile)
		}

		business := api.Group("/business")
		business.Use(middlewares.AuthMiddleware())
		{
			business.POST("", controllers.CreateBusiness)
			business.GET("", controllers.GetBusinesses)
		}

		branch := api.Group("/branches")
		branch.Use(middlewares.AuthMiddleware())
		{
			branch.POST("", controllers.CreateBranch)
			branch.GET("", controllers.GetBranches)
			branch.PUT("/:id", controllers.UpdateBranch)
			branch.DELETE("/:id", controllers.DeleteBranch)

			// Inventory & Products
			branch.POST("/:id/products", controllers.CreateProduct)
			branch.GET("/:id/products", controllers.GetProducts)
			branch.DELETE("/:id/products/:product_id", controllers.DeleteProduct)
			branch.POST("/:id/products/:product_id/movement", controllers.AddStockMovement)
			branch.GET("/:id/movements", controllers.GetStockMovements)
			
			// Orders
			branch.POST("/:id/orders", controllers.CreateOrder)

			// Reports
			branch.GET("/:id/reports/sales", controllers.GetSalesReport)
			branch.GET("/:id/reports/inventory", controllers.GetInventoryReport)
		}
	}

	log.Printf("Backend server starting with Gin on port %s...", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
