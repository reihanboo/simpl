package controllers

import (
	"errors"
	"testing"

	"github.com/google/uuid"
)

func TestCalculateLoyaltyBalance(t *testing.T) {
	tests := []struct {
		name      string
		current   int
		change    int
		want      int
		wantError error
	}{
		{name: "award points", current: 120, change: 30, want: 150},
		{name: "redeem points", current: 120, change: -30, want: 90},
		{name: "reject negative balance", current: 20, change: -21, wantError: errInsufficientLoyaltyPoints},
		{name: "reject balance overflow", current: maxLoyaltyPointBalance, change: 1, wantError: errLoyaltyPointsLimit},
		{name: "reject corrupted negative balance", current: -1, change: 1, wantError: errInsufficientLoyaltyPoints},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got, err := calculateLoyaltyBalance(test.current, test.change)
			if !errors.Is(err, test.wantError) {
				t.Fatalf("calculateLoyaltyBalance() error = %v, want %v", err, test.wantError)
			}
			if err == nil && got != test.want {
				t.Fatalf("calculateLoyaltyBalance() = %d, want %d", got, test.want)
			}
		})
	}
}

func TestValidateLoyaltyReward(t *testing.T) {
	valid := loyaltyRewardInput{Name: "Member discount", PointsRequired: 500, DiscountAmountIDR: 10_000}
	if err := validateLoyaltyReward(valid); err != nil {
		t.Fatalf("valid reward rejected: %v", err)
	}

	invalid := []loyaltyRewardInput{
		{Name: "  ", PointsRequired: 500, DiscountAmountIDR: 10_000},
		{Name: "Reward", PointsRequired: 0, DiscountAmountIDR: 10_000},
		{Name: "Reward", PointsRequired: maxLoyaltyPointsPerAction + 1, DiscountAmountIDR: 10_000},
		{Name: "Reward", PointsRequired: 500, DiscountAmountIDR: 0},
		{Name: "Reward", PointsRequired: 500, DiscountAmountIDR: maxLoyaltyDiscountIDR + 1},
	}
	for index, reward := range invalid {
		if err := validateLoyaltyReward(reward); err == nil {
			t.Errorf("invalid reward at index %d was accepted", index)
		}
	}
}

func TestParseLoyaltyRequestID(t *testing.T) {
	validID := uuid.New()
	parsed, err := parseLoyaltyRequestID(validID.String())
	if err != nil || parsed != validID {
		t.Fatalf("parseLoyaltyRequestID() = %v, %v; want %v, nil", parsed, err, validID)
	}

	for _, value := range []string{"", "not-a-uuid", uuid.Nil.String()} {
		if _, err := parseLoyaltyRequestID(value); err == nil {
			t.Errorf("parseLoyaltyRequestID(%q) expected an error", value)
		}
	}
}
