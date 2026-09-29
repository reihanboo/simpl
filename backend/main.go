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
	config.ConnectAIDB()

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
			auth.POST("/change-password", middlewares.AuthMiddleware(), controllers.ChangePassword)
		}

		// Midtrans server-to-server notification. Unauthenticated: Midtrans calls
		// this directly, and the request is verified via its SHA-512 signature.
		api.POST("/midtrans/notification", controllers.MidtransNotification)

		business := api.Group("/business")
		business.Use(middlewares.AuthMiddleware(), middlewares.EmployeeBusinessAccessMiddleware())
		{
			business.POST("", controllers.CreateBusiness)
			business.GET("", controllers.GetBusinesses)
			business.GET("/invitations", controllers.ListPendingBusinessInvitations)
			business.POST("/invitations/:id/accept", controllers.AcceptBusinessInvitation)
			business.POST("/invitations/:id/decline", controllers.DeclineBusinessInvitation)
			business.GET("/:id/members", controllers.ListBusinessMembers)
			business.DELETE("/:id/members/:user_id", controllers.RemoveBusinessMember)
			business.GET("/:id/invitations", controllers.ListBusinessInvitations)
			business.POST("/:id/invitations", controllers.InviteBusinessMember)
			business.DELETE("/:id/invitations/:invite_id", controllers.RevokeBusinessInvitation)
			business.GET("/:id/subscription/upgrade/quote", controllers.GetSubscriptionUpgradeQuote)
			business.POST("/:id/subscription/upgrade", controllers.CreateSubscriptionUpgrade)
			business.POST("/:id/subscription/upgrade/confirm", controllers.ConfirmSubscriptionUpgrade)
		}

		branch := api.Group("/branches")
		branch.Use(middlewares.AuthMiddleware(), middlewares.EmployeeBranchAccessMiddleware())
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

			// Customer Management System
			branch.GET("/:id/customers", controllers.GetCustomers)
			branch.POST("/:id/customers", controllers.CreateCustomer)
			branch.GET("/:id/customers/:customer_id", controllers.GetCustomer)
			branch.PUT("/:id/customers/:customer_id", controllers.UpdateCustomer)
			branch.DELETE("/:id/customers/:customer_id", controllers.ArchiveCustomer)

			// Employee Management System
			branch.GET("/:id/employees", controllers.GetEmployees)
			branch.POST("/:id/employees", controllers.CreateEmployee)
			branch.PUT("/:id/employees/:employee_id", controllers.UpdateEmployee)
			branch.DELETE("/:id/employees/:employee_id", controllers.DeleteEmployee)
			branch.POST("/:id/employees/:employee_id/attendance/clock-in", controllers.ClockInEmployee)
			branch.POST("/:id/employees/:employee_id/attendance/clock-out", controllers.ClockOutEmployee)

			branch.POST("/:id/customers/:customer_id/points", controllers.AdjustCustomerPoints)
			branch.POST("/:id/customers/:customer_id/redeem", controllers.RedeemLoyaltyReward)
			branch.GET("/:id/loyalty-rewards", controllers.GetLoyaltyRewards)
			branch.POST("/:id/loyalty-rewards", controllers.CreateLoyaltyReward)
			branch.PUT("/:id/loyalty-rewards/:reward_id", controllers.UpdateLoyaltyReward)
			branch.DELETE("/:id/loyalty-rewards/:reward_id", controllers.DeleteLoyaltyReward)

			// Orders
			branch.POST("/:id/orders", controllers.CreateOrder)

			// Reports
			branch.GET("/:id/reports/sales", controllers.GetSalesReport)
			branch.GET("/:id/reports/inventory", controllers.GetInventoryReport)

			// Dashboard
			branch.GET("/:id/dashboard", controllers.GetBranchDashboard)

			// Forecasting
			branch.GET("/:id/forecast", controllers.GetStockForecast)
			branch.GET("/:id/forecast/series", controllers.GetProductForecastSeries)

			// AI assistant (DeepSeek over MCP)
			branch.POST("/:id/chat", controllers.PostAIChat)
		}
	}

	log.Printf("Backend server starting with Gin on port %s...", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
