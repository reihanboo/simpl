package controllers

import (
	"backend/config"
	"backend/models"
	"backend/utils"
	"bytes"
	"crypto/sha512"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type CreateBusinessInput struct {
	Name           string `json:"name" binding:"required"`
	Address        string `json:"address"`
	Plan           string `json:"plan" binding:"required"`
	DurationMonths int    `json:"duration_months"`
}

func CreateBusiness(c *gin.Context) {
	// Get user from context (set by auth middleware)
	userID, exists := c.Get("userID")
	if !exists {
		utils.RespondError(c, http.StatusUnauthorized, "Sesi Anda tidak valid. Silakan masuk kembali.")
		return
	}

	var input CreateBusinessInput
	if err := c.ShouldBindJSON(&input); err != nil {
		utils.RespondBindError(c, err)
		return
	}

	// Calculate price
	var monthlyPrice int64
	if input.Plan == "UMKM" {
		monthlyPrice = 29000
	} else if input.Plan == "Enterprise" {
		monthlyPrice = 149000
	} else {
		utils.RespondError(c, http.StatusBadRequest, "Paket yang dipilih tidak tersedia. Pilih paket yang valid.")
		return
	}

	if input.DurationMonths <= 0 {
		input.DurationMonths = 1
	}

	grossAmount := monthlyPrice * int64(input.DurationMonths)

	// Create Business record
	business := models.Business{
		OwnerID: userID.(uuid.UUID),
		Name:    input.Name,
		Address: input.Address,
	}

	if err := config.DB.Create(&business).Error; err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Usaha belum dapat dibuat. Silakan coba lagi.")
		return
	}

	// Automatically create the first branch
	branch := models.Branch{
		BusinessID: business.ID,
		Name:       "Cabang Utama",
		Address:    input.Address,
	}
	if err := config.DB.Create(&branch).Error; err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Gagal membuat cabang utama. Silakan coba lagi.")
		return
	}

	// Generate unique Order ID for Midtrans
	orderID := fmt.Sprintf("SUB-%s-%d", business.ID.String()[:8], time.Now().Unix())

	// Call Midtrans API to get Snap Token
	serverKey := os.Getenv("MIDTRANS_SERVER_KEY")
	if serverKey == "" {
		serverKey = "" // Fallback if missing
	}
	authKey := base64.StdEncoding.EncodeToString([]byte(serverKey + ":"))

	midtransReqBody := map[string]interface{}{
		"transaction_details": map[string]interface{}{
			"order_id":     orderID,
			"gross_amount": grossAmount,
		},
		"item_details": []map[string]interface{}{
			{
				"id":       "PLAN-" + input.Plan,
				"price":    monthlyPrice,
				"quantity": input.DurationMonths,
				"name":     "SIMPL - Paket " + input.Plan,
			},
		},
		"customer_details": map[string]interface{}{
			"first_name": input.Name, // Using business name for simplicity
		},
	}

	reqBytes, _ := json.Marshal(midtransReqBody)
	req, _ := http.NewRequest("POST", "https://app.sandbox.midtrans.com/snap/v1/transactions", bytes.NewBuffer(reqBytes))
	req.Header.Add("Accept", "application/json")
	req.Header.Add("Content-Type", "application/json")
	req.Header.Add("Authorization", "Basic "+authKey)

	client := &http.Client{Timeout: 10 * time.Second}
	res, err := client.Do(req)
	if err != nil || res.StatusCode != 201 {
		utils.RespondError(c, http.StatusInternalServerError, "Pembayaran belum dapat diproses. Silakan coba lagi.")
		return
	}
	defer res.Body.Close()

	bodyBytes, _ := io.ReadAll(res.Body)
	var midtransRes map[string]interface{}
	json.Unmarshal(bodyBytes, &midtransRes)

	snapToken, ok := midtransRes["token"].(string)
	if !ok {
		utils.RespondError(c, http.StatusInternalServerError, "Sesi pembayaran belum dapat dibuat. Silakan coba lagi.")
		return
	}

	// Create Subscription record
	subscription := models.Subscription{
		BusinessID:        business.ID,
		PlanID:            input.Plan,
		Status:            "pending",
		SnapTokenMidtrans: snapToken,
		MidtransOrderID:   orderID,
		DurationMonths:    input.DurationMonths,
	}

	if err := config.DB.Create(&subscription).Error; err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Langganan belum dapat dibuat. Silakan coba lagi.")
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message":    "Business created",
		"business":   business,
		"snap_token": snapToken,
	})
}

func GetBusinesses(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var businesses []models.Business
	if err := config.DB.Where("owner_id = ?", userID).Find(&businesses).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch businesses"})
		return
	}

	// We'll create a structured response to match what the frontend expects
	type BusinessResponse struct {
		ID           uuid.UUID            `json:"id"`
		Name         string               `json:"name"`
		Address      string               `json:"address"`
		Subscription *models.Subscription `json:"subscription"`
	}

	var response []BusinessResponse
	for _, b := range businesses {
		// Find subscription manually if Preload fails, but Preload should work if the schema is right
		var sub models.Subscription
		config.DB.Where("business_id = ?", b.ID).
			Order("CASE WHEN LOWER(status) = 'active' THEN 0 ELSE 1 END").
			Order("created_at DESC").First(&sub)

		response = append(response, BusinessResponse{
			ID:           b.ID,
			Name:         b.Name,
			Address:      b.Address,
			Subscription: &sub, // include subscription details for frontend
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"businesses": response,
	})
}

type ConfirmSubscriptionUpgradeInput struct {
	SubscriptionID uuid.UUID `json:"subscription_id" binding:"required"`
}

type subscriptionUpgradeQuote struct {
	Amount           int64
	CurrentPeriodEnd time.Time
	DurationMonths   int
	RemainingDays    int
	ExpiryIsEstimate bool
}

func calculateSubscriptionUpgradeQuote(subscription models.Subscription, now time.Time) (subscriptionUpgradeQuote, bool) {
	durationMonths := subscription.DurationMonths
	if durationMonths <= 0 {
		durationMonths = 1
	}

	periodEnd := now.AddDate(0, durationMonths, 0)
	amount := int64(120000 * durationMonths)
	remainingDays := int(math.Ceil(periodEnd.Sub(now).Hours() / 24))

	if subscription.CurrentPeriodEnd != nil {
		if !subscription.CurrentPeriodEnd.After(now) {
			return subscriptionUpgradeQuote{}, false
		}
		periodEnd = *subscription.CurrentPeriodEnd
		periodStart := periodEnd.AddDate(0, -durationMonths, 0)
		periodDuration := periodEnd.Sub(periodStart)
		remainingDuration := periodEnd.Sub(now)
		if periodDuration <= 0 || remainingDuration <= 0 {
			return subscriptionUpgradeQuote{}, false
		}
		amount = int64(math.Round(float64(120000*durationMonths) * float64(remainingDuration) / float64(periodDuration)))
		remainingDays = int(math.Ceil(remainingDuration.Hours() / 24))
	}
	if amount < 1 {
		amount = 1
	}

	return subscriptionUpgradeQuote{
		Amount:           amount,
		CurrentPeriodEnd: periodEnd,
		DurationMonths:   durationMonths,
		RemainingDays:    remainingDays,
		ExpiryIsEstimate: subscription.CurrentPeriodEnd == nil,
	}, true
}

func getActiveUMKMSubscription(businessID uuid.UUID) (models.Subscription, bool) {
	var subscription models.Subscription
	if err := config.DB.Where("business_id = ? AND LOWER(status) = ?", businessID, "active").Order("created_at DESC").First(&subscription).Error; err != nil {
		return models.Subscription{}, false
	}
	if isEnterprisePlan(subscription.PlanID) {
		return subscription, false
	}
	return subscription, true
}

func GetSubscriptionUpgradeQuote(c *gin.Context) {
	userID, exists := c.Get("userID")
	ownerID, validUserID := userID.(uuid.UUID)
	if !exists || !validUserID {
		utils.RespondError(c, http.StatusUnauthorized, "Sesi Anda tidak valid. Silakan masuk kembali.")
		return
	}

	businessID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		utils.RespondError(c, http.StatusBadRequest, "ID bisnis tidak valid.")
		return
	}
	var business models.Business
	if err := config.DB.Where("id = ? AND owner_id = ?", businessID, ownerID).First(&business).Error; err != nil {
		utils.RespondError(c, http.StatusNotFound, "Bisnis tidak ditemukan.")
		return
	}

	subscription, isUMKM := getActiveUMKMSubscription(businessID)
	if !isUMKM {
		utils.RespondError(c, http.StatusConflict, "Langganan UMKM aktif tidak ditemukan atau paket Enterprise sudah aktif.")
		return
	}
	quote, validQuote := calculateSubscriptionUpgradeQuote(subscription, time.Now())
	if !validQuote {
		utils.RespondError(c, http.StatusConflict, "Langganan UMKM sudah berakhir. Silakan perpanjang sebelum upgrade.")
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"umkm_monthly_price":       29000,
		"enterprise_monthly_price": 149000,
		"upgrade_difference":       120000,
		"amount_due":               quote.Amount,
		"current_period_end":       quote.CurrentPeriodEnd,
		"remaining_days":           quote.RemainingDays,
		"expiry_is_estimate":       quote.ExpiryIsEstimate,
	})
}

func CreateSubscriptionUpgrade(c *gin.Context) {
	userID, exists := c.Get("userID")
	ownerID, validUserID := userID.(uuid.UUID)
	if !exists || !validUserID {
		utils.RespondError(c, http.StatusUnauthorized, "Sesi Anda tidak valid. Silakan masuk kembali.")
		return
	}

	businessID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		utils.RespondError(c, http.StatusBadRequest, "ID bisnis tidak valid.")
		return
	}
	var business models.Business
	if err := config.DB.Where("id = ? AND owner_id = ?", businessID, ownerID).First(&business).Error; err != nil {
		utils.RespondError(c, http.StatusNotFound, "Bisnis tidak ditemukan.")
		return
	}

	activeSubscription, isUMKM := getActiveUMKMSubscription(businessID)
	if !isUMKM {
		utils.RespondError(c, http.StatusConflict, "Langganan UMKM aktif tidak ditemukan atau paket Enterprise sudah aktif.")
		return
	}
	quote, validQuote := calculateSubscriptionUpgradeQuote(activeSubscription, time.Now())
	if !validQuote {
		utils.RespondError(c, http.StatusConflict, "Langganan UMKM sudah berakhir. Silakan perpanjang sebelum upgrade.")
		return
	}

	serverKey := os.Getenv("MIDTRANS_SERVER_KEY")
	if serverKey == "" {
		utils.RespondError(c, http.StatusServiceUnavailable, "Pembayaran belum dapat diproses saat ini.")
		return
	}

	subscriptionID := uuid.New()
	orderID := fmt.Sprintf("UPG-%s", subscriptionID.String())
	midtransReqBody := map[string]interface{}{
		"transaction_details": map[string]interface{}{
			"order_id":     orderID,
			"gross_amount": quote.Amount,
		},
		"item_details": []map[string]interface{}{
			{
				"id":       "PLAN-UPGRADE-Enterprise",
				"price":    quote.Amount,
				"quantity": 1,
				"name":     "SIMPL - Selisih Upgrade ke Enterprise",
			},
		},
		"customer_details": map[string]interface{}{"first_name": business.Name},
	}
	requestBody, err := json.Marshal(midtransReqBody)
	if err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Sesi pembayaran belum dapat dibuat. Silakan coba lagi.")
		return
	}

	req, err := http.NewRequest(http.MethodPost, "https://app.sandbox.midtrans.com/snap/v1/transactions", bytes.NewBuffer(requestBody))
	if err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Sesi pembayaran belum dapat dibuat. Silakan coba lagi.")
		return
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", "application/json")
	req.SetBasicAuth(serverKey, "")

	client := &http.Client{Timeout: 10 * time.Second}
	res, err := client.Do(req)
	if err != nil {
		utils.RespondError(c, http.StatusBadGateway, "Pembayaran belum dapat diproses. Silakan coba lagi.")
		return
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusCreated {
		utils.RespondError(c, http.StatusBadGateway, "Pembayaran belum dapat diproses. Silakan coba lagi.")
		return
	}

	var midtransResponse struct {
		Token string `json:"token"`
	}
	if err := json.NewDecoder(res.Body).Decode(&midtransResponse); err != nil || midtransResponse.Token == "" {
		utils.RespondError(c, http.StatusBadGateway, "Sesi pembayaran belum dapat dibuat. Silakan coba lagi.")
		return
	}

	subscription := models.Subscription{
		ID:                subscriptionID,
		BusinessID:        businessID,
		PlanID:            "Enterprise",
		Status:            "pending",
		SnapTokenMidtrans: midtransResponse.Token,
		MidtransOrderID:   orderID,
		DurationMonths:    quote.DurationMonths,
		CurrentPeriodEnd:  &quote.CurrentPeriodEnd,
	}
	if err := config.DB.Create(&subscription).Error; err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Langganan belum dapat dibuat. Silakan coba lagi.")
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"subscription_id":    subscription.ID,
		"snap_token":         midtransResponse.Token,
		"amount_due":         quote.Amount,
		"current_period_end": quote.CurrentPeriodEnd,
	})
}

func ConfirmSubscriptionUpgrade(c *gin.Context) {
	userID, exists := c.Get("userID")
	ownerID, validUserID := userID.(uuid.UUID)
	if !exists || !validUserID {
		utils.RespondError(c, http.StatusUnauthorized, "Sesi Anda tidak valid. Silakan masuk kembali.")
		return
	}

	businessID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		utils.RespondError(c, http.StatusBadRequest, "ID bisnis tidak valid.")
		return
	}

	var business models.Business
	if err := config.DB.Where("id = ? AND owner_id = ?", businessID, ownerID).First(&business).Error; err != nil {
		utils.RespondError(c, http.StatusNotFound, "Bisnis tidak ditemukan.")
		return
	}

	var input ConfirmSubscriptionUpgradeInput
	if err := c.ShouldBindJSON(&input); err != nil {
		utils.RespondBindError(c, err)
		return
	}

	var subscription models.Subscription
	if err := config.DB.Where("id = ? AND business_id = ?", input.SubscriptionID, businessID).First(&subscription).Error; err != nil {
		utils.RespondError(c, http.StatusNotFound, "Transaksi langganan tidak ditemukan.")
		return
	}
	if subscription.Status == "active" {
		c.JSON(http.StatusOK, gin.H{"status": "active"})
		return
	}
	if subscription.Status != "pending" || subscription.MidtransOrderID == "" {
		utils.RespondError(c, http.StatusConflict, "Transaksi langganan ini tidak dapat dikonfirmasi.")
		return
	}

	serverKey := os.Getenv("MIDTRANS_SERVER_KEY")
	if serverKey == "" {
		utils.RespondError(c, http.StatusServiceUnavailable, "Pembayaran belum dapat diverifikasi saat ini.")
		return
	}

	statusURL := fmt.Sprintf("https://api.sandbox.midtrans.com/v2/%s/status", subscription.MidtransOrderID)
	statusRequest, err := http.NewRequest(http.MethodGet, statusURL, nil)
	if err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Pembayaran belum dapat diverifikasi.")
		return
	}
	statusRequest.SetBasicAuth(serverKey, "")
	client := &http.Client{Timeout: 10 * time.Second}
	statusResponse, err := client.Do(statusRequest)
	if err != nil {
		utils.RespondError(c, http.StatusBadGateway, "Pembayaran belum dapat diverifikasi. Silakan coba lagi.")
		return
	}
	defer statusResponse.Body.Close()

	var transaction struct {
		TransactionStatus string `json:"transaction_status"`
		FraudStatus       string `json:"fraud_status"`
	}
	if statusResponse.StatusCode != http.StatusOK || json.NewDecoder(statusResponse.Body).Decode(&transaction) != nil {
		utils.RespondError(c, http.StatusBadGateway, "Pembayaran belum dapat diverifikasi. Silakan coba lagi.")
		return
	}

	result, err := applySubscriptionPaymentStatus(&subscription, transaction.TransactionStatus, transaction.FraudStatus)
	if err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Paket Enterprise telah dibayar, tetapi langganan belum dapat diperbarui. Hubungi dukungan.")
		return
	}

	switch result {
	case subscriptionPaymentPending:
		c.JSON(http.StatusAccepted, gin.H{"status": "pending"})
	case subscriptionPaymentActive:
		c.JSON(http.StatusOK, gin.H{"status": "active"})
	default:
		utils.RespondError(c, http.StatusPaymentRequired, "Pembayaran belum berhasil. Silakan coba lagi.")
	}
}

const (
	subscriptionPaymentActive  = "active"
	subscriptionPaymentPending = "pending"
	subscriptionPaymentFailed  = "failed"
)

// applySubscriptionPaymentStatus applies a Midtrans transaction status to the
// given subscription and reports the resulting outcome: active, pending, or
// failed. It is shared by the client-driven confirm endpoint and the Midtrans
// notification webhook so both stay in sync.
func applySubscriptionPaymentStatus(subscription *models.Subscription, transactionStatus, fraudStatus string) (string, error) {
	status := strings.ToLower(transactionStatus)
	fraud := strings.ToLower(fraudStatus)

	if status == "pending" || (status == "capture" && fraud != "accept") {
		return subscriptionPaymentPending, nil
	}
	if status != "settlement" && status != "capture" {
		if err := config.DB.Model(subscription).Update("status", status).Error; err != nil {
			return subscriptionPaymentFailed, err
		}
		return subscriptionPaymentFailed, nil
	}

	periodEnd := time.Now().AddDate(0, subscription.DurationMonths, 0)
	if subscription.CurrentPeriodEnd != nil {
		periodEnd = *subscription.CurrentPeriodEnd
	}
	if err := config.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&models.Subscription{}).
			Where("business_id = ? AND LOWER(status) = ?", subscription.BusinessID, "active").
			Update("status", "expired").Error; err != nil {
			return err
		}
		return tx.Model(subscription).Updates(map[string]interface{}{
			"status":             "active",
			"current_period_end": periodEnd,
		}).Error
	}); err != nil {
		return subscriptionPaymentFailed, err
	}
	return subscriptionPaymentActive, nil
}

type midtransNotificationInput struct {
	OrderID           string `json:"order_id" binding:"required"`
	StatusCode        string `json:"status_code"`
	GrossAmount       string `json:"gross_amount"`
	SignatureKey      string `json:"signature_key"`
	TransactionStatus string `json:"transaction_status"`
	FraudStatus       string `json:"fraud_status"`
}

// MidtransNotification handles Midtrans' server-to-server HTTP notification and
// updates the matching subscription. The endpoint is unauthenticated (Midtrans
// calls it directly), so authenticity is established with the SHA-512
// signature_key instead of a bearer token.
func MidtransNotification(c *gin.Context) {
	var payload midtransNotificationInput
	if err := c.ShouldBindJSON(&payload); err != nil {
		utils.RespondBindError(c, err)
		return
	}

	serverKey := os.Getenv("MIDTRANS_SERVER_KEY")
	if serverKey == "" {
		utils.RespondError(c, http.StatusServiceUnavailable, "Pembayaran belum dapat diverifikasi saat ini.")
		return
	}

	if !verifyMidtransSignature(payload.OrderID, payload.StatusCode, payload.GrossAmount, serverKey, payload.SignatureKey) {
		utils.RespondError(c, http.StatusUnauthorized, "Signature notifikasi tidak valid.")
		return
	}

	var subscription models.Subscription
	if err := config.DB.Where("midtrans_order_id = ?", payload.OrderID).First(&subscription).Error; err != nil {
		utils.RespondError(c, http.StatusNotFound, "Transaksi langganan tidak ditemukan.")
		return
	}

	if strings.EqualFold(subscription.Status, subscriptionPaymentActive) && strings.EqualFold(payload.TransactionStatus, "settlement") {
		c.JSON(http.StatusOK, gin.H{"status": subscriptionPaymentActive})
		return
	}

	result, err := applySubscriptionPaymentStatus(&subscription, payload.TransactionStatus, payload.FraudStatus)
	if err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Notifikasi pembayaran belum dapat diproses.")
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": result})
}

// verifyMidtransSignature recomputes Midtrans' signature_key as
// sha512(order_id + status_code + gross_amount + server_key) and compares it in
// constant time. See Midtrans' notification signature documentation.
func verifyMidtransSignature(orderID, statusCode, grossAmount, serverKey, signatureKey string) bool {
	if signatureKey == "" {
		return false
	}
	sum := sha512.Sum512([]byte(orderID + statusCode + grossAmount + serverKey))
	expected := hex.EncodeToString(sum[:])
	return subtle.ConstantTimeCompare([]byte(expected), []byte(strings.ToLower(signatureKey))) == 1
}
