package main

import (
	"log"
	"net/http"
	"os"

	"backend/config"
	"backend/controllers"
	"backend/middlewares"

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

	r := gin.Default()

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
			auth.POST("/login", controllers.Login)
			auth.GET("/me", middlewares.AuthMiddleware(), controllers.Me)
		}
	}

	log.Printf("Backend server starting with Gin on port %s...", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
