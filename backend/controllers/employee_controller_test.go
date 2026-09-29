package controllers

import (
	"backend/models"
	"errors"
	"math"
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

func TestHaversineDistanceMeters(t *testing.T) {
	const oneDegreeLatitudeMeters = 111195
	got := haversineDistanceMeters(0, 0, 1, 0)
	if math.Abs(got-oneDegreeLatitudeMeters) > 100 {
		t.Errorf("haversineDistanceMeters() = %.0f, want approximately %d", got, oneDegreeLatitudeMeters)
	}
}

func TestValidateAttendanceLocationEnforcesGeofence(t *testing.T) {
	latitude, longitude, accuracy := 0.0, 0.0, 10.0
	branchLatitude, branchLongitude := 0.0, 0.0
	branch := models.Branch{Latitude: &branchLatitude, Longitude: &branchLongitude, GeofenceRadiusM: 100}

	if _, err := validateAttendanceLocation(branch, attendanceLocationInput{
		Latitude: &latitude, Longitude: &longitude, AccuracyM: &accuracy,
	}); err != nil {
		t.Fatalf("location at branch should be accepted: %v", err)
	}

	latitude = 0.002
	if _, err := validateAttendanceLocation(branch, attendanceLocationInput{
		Latitude: &latitude, Longitude: &longitude, AccuracyM: &accuracy,
	}); !errors.Is(err, errOutsideGeofence) {
		t.Fatalf("location outside branch should be rejected, got %v", err)
	}
}

func TestValidateAttendanceLocationRequiresConfiguredBranchAndAccurateGPS(t *testing.T) {
	latitude, longitude, accuracy := 0.0, 0.0, 101.0
	input := attendanceLocationInput{Latitude: &latitude, Longitude: &longitude, AccuracyM: &accuracy}
	branch := models.Branch{}
	if _, err := validateAttendanceLocation(branch, input); !errors.Is(err, errLocationAccuracy) {
		t.Fatalf("inaccurate GPS should be rejected first, got %v", err)
	}

	accuracy = 10
	if _, err := validateAttendanceLocation(branch, input); !errors.Is(err, errBranchLocationUnset) {
		t.Fatalf("unconfigured branch should be rejected, got %v", err)
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
