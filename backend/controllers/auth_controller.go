package controllers

import (
	"crypto/rand"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"os"
	"time"

	"backend/config"
	"backend/models"
	"backend/utils"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
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
	n, err := rand.Int(rand.Reader, big.NewInt(1000000))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate OTP"})
		return
	}
	otpCode := fmt.Sprintf("%06d", n.Int64())
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
		htmlBody := fmt.Sprintf(`
			<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
				<div style="text-align: center; margin-bottom: 30px;">
					<h1 style="color: #21AC3A; font-size: 28px; margin: 0; font-weight: 800; letter-spacing: -0.5px;">SIMPL</h1>
					<p style="color: #64748b; font-size: 12px; margin-top: 4px; text-transform: uppercase; letter-spacing: 1px;">Enterprise Platform</p>
				</div>
				<p style="color: #334155; font-size: 15px; line-height: 1.6; margin-bottom: 20px;">
					Terima kasih telah menggunakan layanan SIMPL. Saat ini terdapat percobaan pendaftaran pada akun <a href="mailto:%s" style="color: #21AC3A; text-decoration: none; font-weight: 600;">%s</a> melalui portal SIMPL.
				</p>
				<p style="color: #334155; font-size: 15px; line-height: 1.6; margin-bottom: 30px;">
					Untuk melanjutkan proses, gunakan 6 angka berikut untuk autentikasi akun Anda:
				</p>
				<div style="background-color: #f8fafc; border: 1px dashed #cbd5e1; padding: 24px; text-align: center; margin: 30px 0; border-radius: 8px;">
					<span style="font-size: 36px; font-weight: 800; letter-spacing: 12px; color: #0f172a;">%s</span>
				</div>
				<p style="color: #64748b; font-size: 13px; margin-top: 40px; text-align: center; line-height: 1.5;">
					Mohon jangan berikan kode ini kepada siapa pun. Kode ini akan kedaluwarsa dalam <strong>10 menit</strong>.<br>
					Jika Anda tidak melakukan aktivitas ini, abaikan email ini.
				</p>
			</div>
		`, user.Email, user.Email, otpCode)

		params := &resend.SendEmailRequest{
			From:    "onboarding@resend.dev", // Free Resend accounts can only send from this to verified emails
			To:      []string{user.Email},
			Subject: "Kode Autentikasi SIMPL Anda",
			Html:    htmlBody,
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

	if !user.IsVerified {
		c.JSON(http.StatusForbidden, gin.H{"error": "Akun belum diverifikasi. Silakan periksa email Anda untuk OTP."})
		return
	}

	token, err := utils.GenerateToken(user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token":                    token,
		"user_id":                  user.ID,
		"requires_password_change": user.RequiresPasswordChange,
	})
}

type ForgotPasswordInput struct {
	Email string `json:"email" binding:"required,email"`
}

func ForgotPassword(c *gin.Context) {
	var input ForgotPasswordInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user models.User
	if err := config.DB.Where("email = ?", input.Email).First(&user).Error; err != nil {
		// Return 200 to prevent email enumeration
		c.JSON(http.StatusOK, gin.H{"message": "If the email exists, a reset link has been sent."})
		return
	}

	// Generate Reset Token
	resetToken := uuid.New().String()
	expiresAt := time.Now().Add(1 * time.Hour)

	user.ResetPasswordToken = &resetToken
	user.ResetPasswordExpiresAt = &expiresAt
	if err := config.DB.Save(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate reset token"})
		return
	}

	frontendURL := os.Getenv("FRONTEND_URL")
	if frontendURL == "" {
		frontendURL = "http://localhost:3000" // Fallback
	}
	resetLink := fmt.Sprintf("%s/reset-password?token=%s", frontendURL, resetToken)

	// Send Reset Link via Resend
	resendAPIKey := os.Getenv("RESEND_API_KEY")
	if resendAPIKey != "" {
		client := resend.NewClient(resendAPIKey)
		htmlBody := fmt.Sprintf(`
			<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
				<div style="text-align: center; margin-bottom: 30px;">
					<h1 style="color: #21AC3A; font-size: 28px; margin: 0; font-weight: 800; letter-spacing: -0.5px;">SIMPL</h1>
					<p style="color: #64748b; font-size: 12px; margin-top: 4px; text-transform: uppercase; letter-spacing: 1px;">Enterprise Platform</p>
				</div>
				<p style="color: #334155; font-size: 15px; line-height: 1.6; margin-bottom: 20px;">
					Seseorang baru saja meminta pengaturan ulang kata sandi untuk akun <a href="mailto:%s" style="color: #21AC3A; text-decoration: none; font-weight: 600;">%s</a>.
				</p>
				<p style="color: #334155; font-size: 15px; line-height: 1.6; margin-bottom: 30px;">
					Untuk mengatur ulang kata sandi Anda, klik tombol di bawah ini:
				</p>
				<div style="text-align: center; margin: 30px 0;">
					<a href="%s" style="background-color: #21AC3A; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">Atur Ulang Kata Sandi</a>
				</div>
				<p style="color: #64748b; font-size: 13px; margin-top: 40px; text-align: center; line-height: 1.5;">
					Tautan ini akan kedaluwarsa dalam <strong>1 jam</strong>.<br>
					Jika Anda tidak meminta pengaturan ulang kata sandi, abaikan email ini.
				</p>
			</div>
		`, user.Email, user.Email, resetLink)

		params := &resend.SendEmailRequest{
			From:    "onboarding@resend.dev",
			To:      []string{user.Email},
			Subject: "Tautan Atur Ulang Kata Sandi SIMPL",
			Html:    htmlBody,
		}
		_, err := client.Emails.Send(params)
		if err != nil {
			log.Printf("Failed to send email to %s: %v", user.Email, err)
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "If the email exists, a reset link has been sent."})
}

type ResetPasswordInput struct {
	Token       string `json:"token" binding:"required"`
	NewPassword string `json:"new_password" binding:"required,min=6"`
}

func ResetPassword(c *gin.Context) {
	var input ResetPasswordInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user models.User
	if err := config.DB.Where("reset_password_token = ?", input.Token).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired reset token"})
		return
	}

	if user.ResetPasswordExpiresAt == nil || user.ResetPasswordExpiresAt.Before(time.Now()) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Reset token has expired"})
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(input.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	user.PasswordHash = string(hashedPassword)
	user.ResetPasswordToken = nil
	user.ResetPasswordExpiresAt = nil
	user.RequiresPasswordChange = false // clear this in case it was set
	
	if err := config.DB.Save(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to reset password"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Password successfully reset. You can now login."})
}

// Protected route example
func Me(c *gin.Context) {
	userID, _ := c.Get("userID")
	var user models.User
	if err := config.DB.Select("id", "username", "email", "phone", "requires_password_change", "created_at", "updated_at").First(&user, "id = ?", userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"user": user})
}

type UpdateProfileInput struct {
	Username string `json:"username" binding:"omitempty,min=3"`
	Email    string `json:"email" binding:"omitempty,email"`
	Phone    string `json:"phone" binding:"omitempty"`
}

func UpdateProfile(c *gin.Context) {
	userID, _ := c.Get("userID")
	var input UpdateProfileInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user models.User
	if err := config.DB.First(&user, "id = ?", userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	if input.Email != "" && input.Email != user.Email {
		var existing models.User
		if err := config.DB.Where("email = ?", input.Email).First(&existing).Error; err == nil {
			c.JSON(http.StatusConflict, gin.H{"error": "Email already in use"})
			return
		}
		user.Email = input.Email
	}

	if input.Username != "" && input.Username != user.Username {
		var existing models.User
		if err := config.DB.Where("username = ?", input.Username).First(&existing).Error; err == nil {
			c.JSON(http.StatusConflict, gin.H{"error": "Username already taken"})
			return
		}
		user.Username = input.Username
	}

	if input.Phone != "" {
		user.Phone = input.Phone
	}

	if err := config.DB.Save(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update profile"})
		return
	}

	// Fetch updated user to return
	var updatedUser models.User
	config.DB.Select("id", "username", "email", "phone", "requires_password_change", "created_at", "updated_at").First(&updatedUser, "id = ?", userID)

	c.JSON(http.StatusOK, gin.H{"message": "Profile successfully updated", "user": updatedUser})
}
