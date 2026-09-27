package utils

import "math"

// Welford maintains a running mean and variance over a stream of values using
// Welford's online algorithm. It is numerically stable and avoids the
// cancellation errors of the naive sum-of-squares approach.
type Welford struct {
	Count int
	Mean  float64
	M2    float64
}

// Add incorporates a new observation into the running statistics.
func (w *Welford) Add(x float64) {
	w.Count++
	delta := x - w.Mean
	w.Mean += delta / float64(w.Count)
	w.M2 += delta * (x - w.Mean)
}

// Variance returns the sample variance of the observed values.
func (w *Welford) Variance() float64 {
	if w.Count < 2 {
		return 0
	}
	return w.M2 / float64(w.Count-1)
}

// StdDev returns the sample standard deviation of the observed values.
func (w *Welford) StdDev() float64 {
	return math.Sqrt(w.Variance())
}

// SimpleMovingAverage returns the mean of the most recent window observations.
func SimpleMovingAverage(series []float64, window int) float64 {
	if len(series) == 0 {
		return 0
	}
	if window <= 0 || window > len(series) {
		window = len(series)
	}
	sum := 0.0
	for _, v := range series[len(series)-window:] {
		sum += v
	}
	return sum / float64(window)
}

// ExponentialMovingAverage returns the smoothed level of the series using the
// smoothing factor alpha (0 < alpha <= 1), which weights recent values more
// heavily than older ones. alpha falls back to 0.3 when out of range.
func ExponentialMovingAverage(series []float64, alpha float64) float64 {
	if len(series) == 0 {
		return 0
	}
	if alpha <= 0 || alpha > 1 {
		alpha = 0.3
	}
	ema := series[0]
	for _, v := range series[1:] {
		ema = alpha*v + (1-alpha)*ema
	}
	return ema
}

// DemandStats summarizes a daily demand series: the Welford mean and standard
// deviation of daily demand plus a smoothed level used as the forecast rate.
type DemandStats struct {
	Count    int
	Mean     float64
	StdDev   float64
	Smoothed float64
}

// AnalyzeDemand computes Welford statistics over the daily demand series and a
// smoothed demand rate. algorithm selects the smoothing method ("sma" or "ema");
// alpha tunes the EMA and window tunes the SMA.
func AnalyzeDemand(series []float64, algorithm string, alpha float64, window int) DemandStats {
	welford := &Welford{}
	for _, v := range series {
		welford.Add(v)
	}

	var smoothed float64
	if algorithm == "sma" {
		smoothed = SimpleMovingAverage(series, window)
	} else {
		smoothed = ExponentialMovingAverage(series, alpha)
	}

	return DemandStats{
		Count:    welford.Count,
		Mean:     welford.Mean,
		StdDev:   welford.StdDev(),
		Smoothed: smoothed,
	}
}
