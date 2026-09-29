package controllers

import (
	"backend/models"
	"math"
	"testing"
	"time"
)

func TestCalculateSubscriptionUpgradeQuoteProratesRemainingTerm(t *testing.T) {
	now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	periodEnd := time.Date(2026, 7, 1, 0, 0, 0, 0, time.UTC)
	subscription := models.Subscription{
		DurationMonths:   12,
		CurrentPeriodEnd: &periodEnd,
	}

	quote, ok := calculateSubscriptionUpgradeQuote(subscription, now)
	if !ok {
		t.Fatal("expected active subscription to produce an upgrade quote")
	}

	periodStart := periodEnd.AddDate(0, -12, 0)
	wantAmount := int64(math.Round(float64(120000*12) * float64(periodEnd.Sub(now)) / float64(periodEnd.Sub(periodStart))))
	if quote.Amount != wantAmount {
		t.Errorf("quote amount = %d, want prorated amount %d", quote.Amount, wantAmount)
	}
	if !quote.CurrentPeriodEnd.Equal(periodEnd) {
		t.Errorf("quote expiry = %v, want existing expiry %v", quote.CurrentPeriodEnd, periodEnd)
	}
	if quote.ExpiryIsEstimate {
		t.Error("quote should use the recorded expiry date")
	}
}

func TestCalculateSubscriptionUpgradeQuoteEstimatesMissingExpiry(t *testing.T) {
	now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	quote, ok := calculateSubscriptionUpgradeQuote(models.Subscription{DurationMonths: 1}, now)
	if !ok {
		t.Fatal("expected subscription without a recorded expiry to produce a quote")
	}
	if quote.Amount != 120000 {
		t.Errorf("quote amount = %d, want monthly difference of 120000", quote.Amount)
	}
	if !quote.ExpiryIsEstimate {
		t.Error("quote should mark a missing expiry as estimated")
	}
}

func TestCalculateSubscriptionUpgradeQuoteRejectsExpiredPlan(t *testing.T) {
	now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	periodEnd := now.Add(-time.Hour)
	if _, ok := calculateSubscriptionUpgradeQuote(models.Subscription{
		DurationMonths:   1,
		CurrentPeriodEnd: &periodEnd,
	}, now); ok {
		t.Error("expected expired subscription to be rejected")
	}
}
