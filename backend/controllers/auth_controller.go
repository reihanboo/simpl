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
	Phone    string `json:"phone" binding:"required"`
	Password string `json:"password" binding:"required,min=6"`
}

func Register(c *gin.Context) {
	var input RegisterInput
	if err := c.ShouldBindJSON(&input); err != nil {
		utils.RespondBindError(c, err)
		return
	}
	if !utils.IsValidIndonesianMobilePhone(input.Phone) {
		utils.RespondError(c, http.StatusBadRequest, "Masukkan nomor handphone Indonesia yang valid, misalnya 081234567890 atau +6281234567890.")
		return
	}

	// Check if email or username already exists
	var existingUser models.User
	if err := config.DB.Where("email = ? OR username = ?", input.Email, input.Username).First(&existingUser).Error; err == nil {
		utils.RespondError(c, http.StatusConflict, "Email atau nama pengguna sudah digunakan.")
		return
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Kata sandi tidak dapat diproses. Silakan coba lagi.")
		return
	}

	// Generate OTP
	n, err := rand.Int(rand.Reader, big.NewInt(1000000))
	if err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Kode verifikasi tidak dapat dibuat. Silakan coba lagi.")
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
		OTPAttempts:  0,
		IsVerified:   false,
	}

	if err := config.DB.Create(&user).Error; err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Akun belum dapat dibuat. Silakan coba lagi.")
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
	OTPCode string `json:"otp_code" binding:"required,len=6,numeric"`
}

func VerifyOTP(c *gin.Context) {
	var input VerifyOTPInput
	if err := c.ShouldBindJSON(&input); err != nil {
		utils.RespondBindError(c, err)
		return
	}

	var user models.User
	if err := config.DB.Where("email = ?", input.Email).First(&user).Error; err != nil {
		utils.RespondError(c, http.StatusNotFound, "Akun dengan email tersebut tidak ditemukan.")
		return
	}

	if user.IsVerified {
		utils.RespondError(c, http.StatusBadRequest, "Akun Anda sudah terverifikasi.")
		return
	}

	if user.OTPExpiresAt == nil || user.OTPExpiresAt.Before(time.Now()) {
		utils.RespondError(c, http.StatusUnauthorized, "Kode OTP sudah kedaluwarsa. Minta kode baru untuk melanjutkan.")
		return
	}

	if user.OTPAttempts >= 5 {
		utils.RespondError(c, http.StatusTooManyRequests, "Terlalu banyak percobaan. Silakan minta kode OTP baru.")
		return
	}

	if user.OTPCode == nil || *user.OTPCode != input.OTPCode {
		user.OTPAttempts++
		config.DB.Save(&user)
		utils.RespondError(c, http.StatusUnauthorized, "Kode OTP tidak sesuai. Periksa kembali kode yang Anda masukkan.")
		return
	}

	// OTP is valid
	user.IsVerified = true
	user.OTPCode = nil
	user.OTPExpiresAt = nil
	user.OTPAttempts = 0

	if err := config.DB.Save(&user).Error; err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Verifikasi akun belum berhasil. Silakan coba lagi.")
		return
	}

	// Optionally log them in immediately
	token, err := utils.GenerateToken(user.ID)
	if err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Akun terverifikasi, tetapi sesi tidak dapat dibuat. Silakan masuk.")
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "User successfully verified",
		"token":   token,
		"user_id": user.ID,
	})
}

type ResendOTPInput struct {
	Email string `json:"email" binding:"required,email"`
}

func ResendOTP(c *gin.Context) {
	var input ResendOTPInput
	if err := c.ShouldBindJSON(&input); err != nil {
		utils.RespondBindError(c, err)
		return
	}

	var user models.User
	if err := config.DB.Where("email = ?", input.Email).First(&user).Error; err != nil {
		utils.RespondError(c, http.StatusNotFound, "Akun dengan email tersebut tidak ditemukan.")
		return
	}

	if user.IsVerified {
		utils.RespondError(c, http.StatusBadRequest, "Akun Anda sudah terverifikasi.")
		return
	}

	// Generate new OTP
	n, err := rand.Int(rand.Reader, big.NewInt(1000000))
	if err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Kode verifikasi tidak dapat dibuat. Silakan coba lagi.")
		return
	}
	otpCode := fmt.Sprintf("%06d", n.Int64())
	expiresAt := time.Now().Add(10 * time.Minute)

	user.OTPCode = &otpCode
	user.OTPExpiresAt = &expiresAt
	user.OTPAttempts = 0

	if err := config.DB.Save(&user).Error; err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Kode verifikasi belum dapat diperbarui. Silakan coba lagi.")
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
					Terima kasih telah menggunakan layanan SIMPL. Kami mengirimkan ulang kode OTP untuk akun <a href="mailto:%s" style="color: #21AC3A; text-decoration: none; font-weight: 600;">%s</a>.
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
			From:    "onboarding@resend.dev",
			To:      []string{user.Email},
			Subject: "Kode Autentikasi SIMPL Anda (Kirim Ulang)",
			Html:    htmlBody,
		}
		_, err = client.Emails.Send(params)
		if err != nil {
			log.Printf("Failed to resend email to %s: %v", user.Email, err)
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "New OTP sent to email"})
}

type LoginInput struct {
	Identity string `json:"identity" binding:"required"` // Can be email or username
	Password string `json:"password" binding:"required"`
}

func Login(c *gin.Context) {
	var input LoginInput
	if err := c.ShouldBindJSON(&input); err != nil {
		utils.RespondBindError(c, err)
		return
	}

	var user models.User
	if err := config.DB.Where("email = ? OR username = ?", input.Identity, input.Identity).First(&user).Error; err != nil {
		utils.RespondError(c, http.StatusUnauthorized, "Email/nama pengguna atau kata sandi tidak sesuai.")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(input.Password)); err != nil {
		utils.RespondError(c, http.StatusUnauthorized, "Email/nama pengguna atau kata sandi tidak sesuai.")
		return
	}

	if !user.IsVerified {
		c.JSON(http.StatusForbidden, gin.H{
			"error": "Akun Anda belum terverifikasi. Periksa email untuk kode OTP.",
			"email": user.Email,
		})
		return
	}

	token, err := utils.GenerateToken(user.ID)
	if err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Sesi masuk tidak dapat dibuat. Silakan coba lagi.")
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
		utils.RespondBindError(c, err)
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
		utils.RespondError(c, http.StatusInternalServerError, "Permintaan atur ulang kata sandi belum dapat diproses. Silakan coba lagi.")
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
		utils.RespondBindError(c, err)
		return
	}

	var user models.User
	if err := config.DB.Where("reset_password_token = ?", input.Token).First(&user).Error; err != nil {
		utils.RespondError(c, http.StatusUnauthorized, "Tautan atur ulang kata sandi tidak valid atau sudah kedaluwarsa.")
		return
	}

	if user.ResetPasswordExpiresAt == nil || user.ResetPasswordExpiresAt.Before(time.Now()) {
		utils.RespondError(c, http.StatusUnauthorized, "Tautan atur ulang kata sandi sudah kedaluwarsa. Minta tautan baru.")
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(input.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Kata sandi tidak dapat diproses. Silakan coba lagi.")
		return
	}

	user.PasswordHash = string(hashedPassword)
	user.ResetPasswordToken = nil
	user.ResetPasswordExpiresAt = nil
	user.RequiresPasswordChange = false // clear this in case it was set

	if err := config.DB.Save(&user).Error; err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Kata sandi belum berhasil diubah. Silakan coba lagi.")
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Password successfully reset. You can now login."})
}

// Protected route example
func Me(c *gin.Context) {
	userID, _ := c.Get("userID")
	var user models.User
	if err := config.DB.Select("id", "username", "email", "phone", "requires_password_change", "created_at", "updated_at").First(&user, "id = ?", userID).Error; err != nil {
		utils.RespondError(c, http.StatusNotFound, "Akun tidak ditemukan.")
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
		utils.RespondBindError(c, err)
		return
	}
	if input.Phone != "" && !utils.IsValidIndonesianMobilePhone(input.Phone) {
		utils.RespondError(c, http.StatusBadRequest, "Masukkan nomor handphone Indonesia yang valid, misalnya 081234567890 atau +6281234567890.")
		return
	}

	var user models.User
	if err := config.DB.First(&user, "id = ?", userID).Error; err != nil {
		utils.RespondError(c, http.StatusNotFound, "Akun tidak ditemukan.")
		return
	}

	if input.Email != "" && input.Email != user.Email {
		var existing models.User
		if err := config.DB.Where("email = ?", input.Email).First(&existing).Error; err == nil {
			utils.RespondError(c, http.StatusConflict, "Email tersebut sudah digunakan oleh akun lain.")
			return
		}
		user.Email = input.Email
	}

	if input.Username != "" && input.Username != user.Username {
		var existing models.User
		if err := config.DB.Where("username = ?", input.Username).First(&existing).Error; err == nil {
			utils.RespondError(c, http.StatusConflict, "Nama pengguna tersebut sudah digunakan.")
			return
		}
		user.Username = input.Username
	}

	if input.Phone != "" {
		user.Phone = input.Phone
	}

	if err := config.DB.Save(&user).Error; err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Profil belum berhasil diperbarui. Silakan coba lagi.")
		return
	}

	// Fetch updated user to return
	var updatedUser models.User
	config.DB.Select("id", "username", "email", "phone", "requires_password_change", "created_at", "updated_at").First(&updatedUser, "id = ?", userID)

	c.JSON(http.StatusOK, gin.H{"message": "Profile successfully updated", "user": updatedUser})
}
