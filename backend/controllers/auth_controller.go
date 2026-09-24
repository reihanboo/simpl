package controllers

import (
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"os"
	"time"

	"backend/config"
	"backend/models"
	"backend/utils"

	"github.com/gin-gonic/gin"
	"github.com/resend/resend-go/v2"
	"golang.org/x/crypto/bcrypt"
)

type RegisterInput struct {
	Username string `json:"username" binding:"required"`
	Email    string `json:"email" binding:"required,email"`
	Phone    string `json:"phone"`
	Password string `json:"password" binding:"required,min=6"`
}

func Register(c *gin.Context) {
	var input RegisterInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check if email or username already exists
	var existingUser models.User
	if err := config.DB.Where("email = ? OR username = ?", input.Email, input.Username).First(&existingUser).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Email or Username already taken"})
		return
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	// Generate OTP
	otpCode := fmt.Sprintf("%06d", rand.Intn(1000000))
	expiresAt := time.Now().Add(10 * time.Minute)

	// Create user
	user := models.User{
		Username:     input.Username,
		Email:        input.Email,
		Phone:        input.Phone,
		PasswordHash: string(hashedPassword),
		OTPCode:      &otpCode,
		OTPExpiresAt: &expiresAt,
		IsVerified:   false,
	}

	if err := config.DB.Create(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
		return
	}

	// Send OTP via Resend
	resendAPIKey := os.Getenv("RESEND_API_KEY")
	if resendAPIKey != "" {
		client := resend.NewClient(resendAPIKey)
		params := &resend.SendEmailRequest{
			From:    "onboarding@resend.dev", // Free Resend accounts can only send from this to verified emails
			To:      []string{user.Email},
			Subject: "Kode Verifikasi SIMPL Anda",
			Html:    fmt.Sprintf("<strong>Kode OTP Anda adalah: %s</strong><br>Berlaku selama 10 menit.", otpCode),
		}
		_, err = client.Emails.Send(params)
		if err != nil {
			log.Printf("Failed to send email to %s: %v", user.Email, err)
		}
	}

	c.JSON(http.StatusCreated, gin.H{"message": "User registered, OTP sent to email"})
}

type VerifyOTPInput struct {
	Email   string `json:"email" binding:"required,email"`
	OTPCode string `json:"otp_code" binding:"required,len=6"`
}

func VerifyOTP(c *gin.Context) {
	var input VerifyOTPInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user models.User
	if err := config.DB.Where("email = ?", input.Email).First(&user).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	if user.IsVerified {
		c.JSON(http.StatusBadRequest, gin.H{"error": "User is already verified"})
		return
	}

	if user.OTPCode == nil || *user.OTPCode != input.OTPCode {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid OTP code"})
		return
	}

	if user.OTPExpiresAt == nil || user.OTPExpiresAt.Before(time.Now()) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "OTP has expired"})
		return
	}

	// OTP is valid
	user.IsVerified = true
	user.OTPCode = nil
	user.OTPExpiresAt = nil

	if err := config.DB.Save(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify user"})
		return
	}

	// Optionally log them in immediately
	token, err := utils.GenerateToken(user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Verified but failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "User successfully verified",
		"token":   token,
		"user_id": user.ID,
	})
}


type LoginInput struct {
	Identity string `json:"identity" binding:"required"` // Can be email or username
	Password string `json:"password" binding:"required"`
}

func Login(c *gin.Context) {
	var input LoginInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user models.User
	if err := config.DB.Where("email = ? OR username = ?", input.Identity, input.Identity).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(input.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	token, err := utils.GenerateToken(user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token":   token,
		"user_id": user.ID,
	})
}

// Protected route example
func Me(c *gin.Context) {
	userID, _ := c.Get("userID")
	var user models.User
	if err := config.DB.Select("id", "username", "email", "phone", "created_at", "updated_at").First(&user, "id = ?", userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"user": user})
}
