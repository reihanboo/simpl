package utils

import (
	"math"
	"testing"
)

func almostEqual(a, b, tolerance float64) bool {
	return math.Abs(a-b) <= tolerance
}

func TestWelfordMatchesDirectComputation(t *testing.T) {
	values := []float64{2, 4, 4, 4, 5, 5, 7, 9}

	w := &Welford{}
	for _, v := range values {
		w.Add(v)
	}

	if w.Count != len(values) {
		t.Fatalf("Count = %d, want %d", w.Count, len(values))
	}
	if !almostEqual(w.Mean, 5.0, 1e-9) {
		t.Errorf("Mean = %v, want 5", w.Mean)
	}
	// Sample standard deviation of the values above.
	if !almostEqual(w.StdDev(), 2.138089935299395, 1e-9) {
		t.Errorf("StdDev = %v, want 2.138089935299395", w.StdDev())
	}
}

func TestWelfordSingleValue(t *testing.T) {
	w := &Welford{}
	w.Add(7)

	if !almostEqual(w.Mean, 7, 1e-9) {
		t.Errorf("Mean = %v, want 7", w.Mean)
	}
	if w.Variance() != 0 || w.StdDev() != 0 {
		t.Errorf("Variance/StdDev = %v/%v, want 0/0", w.Variance(), w.StdDev())
	}
}

func TestSimpleMovingAverage(t *testing.T) {
	series := []float64{1, 2, 3, 4}

	if got := SimpleMovingAverage(series, 2); !almostEqual(got, 3.5, 1e-9) {
		t.Errorf("SMA(window=2) = %v, want 3.5", got)
	}
	if got := SimpleMovingAverage(series, 10); !almostEqual(got, 2.5, 1e-9) {
		t.Errorf("SMA(window>len) = %v, want 2.5", got)
	}
	if got := SimpleMovingAverage(nil, 3); got != 0 {
		t.Errorf("SMA(nil) = %v, want 0", got)
	}
}

func TestExponentialMovingAverage(t *testing.T) {
	series := []float64{0, 10}

	// alpha = 1 weights only the latest value.
	if got := ExponentialMovingAverage(series, 1); !almostEqual(got, 10, 1e-9) {
		t.Errorf("EMA(alpha=1) = %v, want 10", got)
	}
	// alpha = 0.5 halves the contribution each step.
	if got := ExponentialMovingAverage(series, 0.5); !almostEqual(got, 5, 1e-9) {
		t.Errorf("EMA(alpha=0.5) = %v, want 5", got)
	}
}

func TestAnalyzeDemand(t *testing.T) {
	series := []float64{0, 0, 2, 2, 4}

	stats := AnalyzeDemand(series, "sma", 0.3, 3)
	if stats.Count != 5 {
		t.Fatalf("Count = %d, want 5", stats.Count)
	}
	if !almostEqual(stats.Mean, 1.6, 1e-9) {
		t.Errorf("Mean = %v, want 1.6", stats.Mean)
	}
	// SMA over the last 3 values: (2 + 2 + 4) / 3.
	if !almostEqual(stats.Smoothed, 8.0/3.0, 1e-9) {
		t.Errorf("Smoothed = %v, want %v", stats.Smoothed, 8.0/3.0)
	}
}
