package controllers

import (
	"backend/config"
	"backend/models"
	"backend/utils"
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
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
		config.DB.Where("business_id = ?", b.ID).First(&sub)

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
