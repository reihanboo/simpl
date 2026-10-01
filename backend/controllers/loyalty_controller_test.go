package controllers

import (
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestCalculateVoucherDiscount(t *testing.T) {
	maxDiscount := int64(1500)
	tests := []struct {
		name         string
		subtotal     int64
		discountType string
		fixedAmount  int64
		percentage   float64
		maxDiscount  *int64
		want         int64
		wantError    bool
	}{
		{name: "fixed discount", subtotal: 10000, discountType: "fixed", fixedAmount: 2000, want: 2000},
		{name: "fixed discount capped at total", subtotal: 1000, discountType: "fixed", fixedAmount: 2000, want: 1000},
		{name: "percentage discount", subtotal: 10000, discountType: "percentage", percentage: 10, want: 1000},
		{name: "percentage maximum applies", subtotal: 20000, discountType: "percentage", percentage: 20, maxDiscount: &maxDiscount, want: 1500},
		{name: "reject unsupported type", subtotal: 10000, discountType: "other", wantError: true},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got, err := calculateVoucherDiscount(test.subtotal, test.discountType, test.fixedAmount, test.percentage, test.maxDiscount)
			if (err != nil) != test.wantError {
				t.Fatalf("calculateVoucherDiscount() error = %v, wantError %t", err, test.wantError)
			}
			if err == nil && got != test.want {
				t.Fatalf("calculateVoucherDiscount() = %d, want %d", got, test.want)
			}
		})
	}
}

func TestCalculateEarnedLoyaltyPoints(t *testing.T) {
	tests := []struct {
		name      string
		amount    int64
		rate      int64
		want      int
		wantError bool
	}{
		{name: "below earning threshold", amount: 999, rate: 1000, want: 0},
		{name: "one point per threshold", amount: 1000, rate: 1000, want: 1},
		{name: "floor remainder", amount: 2999, rate: 1000, want: 2},
		{name: "custom threshold", amount: 10000, rate: 2500, want: 4},
		{name: "reject zero threshold", amount: 1000, rate: 0, wantError: true},
		{name: "reject excessive points", amount: int64(maxLoyaltyPointsPerAction+1) * 1000, rate: 1000, wantError: true},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got, err := calculateEarnedLoyaltyPoints(test.amount, test.rate)
			if (err != nil) != test.wantError {
				t.Fatalf("calculateEarnedLoyaltyPoints() error = %v, wantError %t", err, test.wantError)
			}
			if err == nil && got != test.want {
				t.Fatalf("calculateEarnedLoyaltyPoints() = %d, want %d", got, test.want)
			}
		})
	}
}

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
	validFixed := loyaltyRewardInput{Name: "Member discount", PointsRequired: 500, DiscountAmountIDR: 10_000}
	if err := validateLoyaltyReward(validFixed); err != nil {
		t.Fatalf("valid fixed reward rejected: %v", err)
	}
	validPercentage := loyaltyRewardInput{
		Name: "Member percentage discount", PointsRequired: 500,
		DiscountType: "percentage", DiscountPercentage: 15,
		MaxDiscountAmountIDR: loyaltyInt64Pointer(50_000),
		UsageLimit:           loyaltyIntPointer(100), PerCustomerLimit: loyaltyIntPointer(2),
		StartsAt: loyaltyTimePointer(time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)),
		EndsAt:   loyaltyTimePointer(time.Date(2026, 12, 31, 0, 0, 0, 0, time.UTC)),
	}
	if err := validateLoyaltyReward(validPercentage); err != nil {
		t.Fatalf("valid percentage reward rejected: %v", err)
	}

	invalid := []loyaltyRewardInput{
		{Name: "  ", PointsRequired: 500, DiscountAmountIDR: 10_000},
		{Name: "Reward", PointsRequired: 0, DiscountAmountIDR: 10_000},
		{Name: "Reward", PointsRequired: maxLoyaltyPointsPerAction + 1, DiscountAmountIDR: 10_000},
		{Name: "Reward", PointsRequired: 500, DiscountAmountIDR: 0},
		{Name: "Reward", PointsRequired: 500, DiscountAmountIDR: maxLoyaltyDiscountIDR + 1},
		{Name: "Reward", PointsRequired: 500, DiscountType: "percentage", DiscountPercentage: 0},
		{Name: "Reward", PointsRequired: 500, DiscountType: "percentage", DiscountPercentage: 101},
		{Name: "Reward", PointsRequired: 500, DiscountType: "percentage", DiscountPercentage: 10, DiscountAmountIDR: 100},
		{Name: "Reward", PointsRequired: 500, DiscountType: "other", DiscountAmountIDR: 10_000},
		{Name: "Reward", PointsRequired: 500, DiscountAmountIDR: 10_000, UsageLimit: loyaltyIntPointer(0)},
		{Name: "Reward", PointsRequired: 500, DiscountAmountIDR: 10_000, PerCustomerLimit: loyaltyIntPointer(-1)},
		{Name: "Reward", PointsRequired: 500, DiscountAmountIDR: 10_000, StartsAt: loyaltyTimePointer(time.Date(2026, 2, 1, 0, 0, 0, 0, time.UTC)), EndsAt: loyaltyTimePointer(time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC))},
	}
	for index, reward := range invalid {
		if err := validateLoyaltyReward(reward); err == nil {
			t.Errorf("invalid reward at index %d was accepted", index)
		}
	}
}

func loyaltyIntPointer(value int) *int { return &value }

func loyaltyInt64Pointer(value int64) *int64 { return &value }

func loyaltyTimePointer(value time.Time) *time.Time { return &value }

func TestValidateLoyaltyCustomerIDs(t *testing.T) {
	firstID := uuid.New()
	secondID := uuid.New()
	if err := validateLoyaltyCustomerIDs([]uuid.UUID{firstID, secondID}); err != nil {
		t.Fatalf("unique customer targets rejected: %v", err)
	}
	if err := validateLoyaltyCustomerIDs(nil); err != nil {
		t.Fatalf("unrestricted customer target rejected: %v", err)
	}
	for _, ids := range [][]uuid.UUID{{firstID, firstID}, {uuid.Nil}} {
		if err := validateLoyaltyCustomerIDs(ids); !errors.Is(err, errLoyaltyCustomerTargetsInvalid) {
			t.Errorf("invalid customer targets %v: error = %v, want %v", ids, err, errLoyaltyCustomerTargetsInvalid)
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
