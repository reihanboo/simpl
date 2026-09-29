package controllers

import (
	"crypto/sha512"
	"encoding/hex"
	"strings"
	"testing"
)

func TestVerifyMidtransSignature(t *testing.T) {
	const (
		orderID     = "SUB-174179c4-1790400876"
		statusCode  = "202"
		grossAmount = "3576000.00"
		serverKey   = "test-server-key"
	)
	sum := sha512.Sum512([]byte(orderID + statusCode + grossAmount + serverKey))
	signature := hex.EncodeToString(sum[:])

	cases := []struct {
		name         string
		orderID      string
		statusCode   string
		grossAmount  string
		serverKey    string
		signatureKey string
		want         bool
	}{
		{"valid", orderID, statusCode, grossAmount, serverKey, signature, true},
		{"uppercase signature", orderID, statusCode, grossAmount, serverKey, strings.ToUpper(signature), true},
		{"tampered amount", orderID, statusCode, "1.00", serverKey, signature, false},
		{"wrong server key", orderID, statusCode, grossAmount, "other-key", signature, false},
		{"empty signature", orderID, statusCode, grossAmount, serverKey, "", false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := verifyMidtransSignature(tc.orderID, tc.statusCode, tc.grossAmount, tc.serverKey, tc.signatureKey)
			if got != tc.want {
				t.Fatalf("verifyMidtransSignature() = %v, want %v", got, tc.want)
			}
		})
	}
}
