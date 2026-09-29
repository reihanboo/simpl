package controllers

import (
	"testing"
	"time"
)

func TestEmployeeAttendanceStatusUsesShiftStart(t *testing.T) {
	shiftStart := time.Date(2026, 5, 12, 8, 0, 0, 0, jakartaLocation)
	tests := []struct {
		name    string
		clockIn time.Time
		want    string
	}{
		{name: "before shift", clockIn: shiftStart.Add(-time.Minute), want: "Hadir"},
		{name: "at shift start", clockIn: shiftStart, want: "Hadir"},
		{name: "after shift start", clockIn: shiftStart.Add(time.Minute), want: "Terlambat"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := employeeAttendanceStatus("08.00 – 16.00", test.clockIn); got != test.want {
				t.Errorf("employeeAttendanceStatus() = %q, want %q", got, test.want)
			}
		})
	}
}

func TestJakartaDateUsesBusinessTimezone(t *testing.T) {
	value := time.Date(2026, 5, 12, 18, 0, 0, 0, time.UTC)
	got := jakartaDate(value)
	want := time.Date(2026, 5, 13, 0, 0, 0, 0, jakartaLocation)
	if !got.Equal(want) {
		t.Errorf("jakartaDate() = %s, want %s", got, want)
	}
}
