package controllers

import (
	"backend/config"
	"backend/models"
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
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var input CreateBusinessInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Calculate price
	var monthlyPrice int64
	if input.Plan == "UMKM" {
		monthlyPrice = 29000
	} else if input.Plan == "Enterprise" {
		monthlyPrice = 149000
	} else {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid plan selected"})
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
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create business"})
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
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to contact payment gateway"})
		return
	}
	defer res.Body.Close()

	bodyBytes, _ := io.ReadAll(res.Body)
	var midtransRes map[string]interface{}
	json.Unmarshal(bodyBytes, &midtransRes)

	snapToken, ok := midtransRes["token"].(string)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get snap token"})
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
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create subscription"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message":    "Business created",
		"business":   business,
		"snap_token": snapToken,
	})
}
