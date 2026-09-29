package controllers

import (
	"backend/models"
	"backend/utils"
	"errors"
	"math"
	"testing"
	"time"
)

func TestEmployeeAttendanceStatusUsesShiftStart(t *testing.T) {
	jakartaLocation := testTimezone(t, "Asia/Jakarta")
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
			if got := employeeAttendanceStatus("08.00 – 16.00", test.clockIn, jakartaLocation); got != test.want {
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
	} else {
		var diagnostic *attendanceGeofenceError
		if !errors.As(err, &diagnostic) {
			t.Fatalf("outside-geofence error should include diagnostic values, got %T", err)
		}
		if diagnostic.RadiusM != branch.GeofenceRadiusM || diagnostic.AccuracyM != accuracy || diagnostic.DistanceM <= float64(branch.GeofenceRadiusM) {
			t.Errorf("unexpected geofence diagnostic: %+v", diagnostic)
		}
	}
}

func TestValidateAttendanceLocationAccountsForGPSUncertaintyAtBoundary(t *testing.T) {
	latitude, longitude, accuracy := 0.00105, 0.0, 20.0
	branchLatitude, branchLongitude := 0.0, 0.0
	branch := models.Branch{Latitude: &branchLatitude, Longitude: &branchLongitude, GeofenceRadiusM: 100}

	if _, err := validateAttendanceLocation(branch, attendanceLocationInput{
		Latitude: &latitude, Longitude: &longitude, AccuracyM: &accuracy,
	}); err != nil {
		t.Fatalf("location within GPS uncertainty of the geofence should be accepted: %v", err)
	}

	latitude = 0.0012
	if _, err := validateAttendanceLocation(branch, attendanceLocationInput{
		Latitude: &latitude, Longitude: &longitude, AccuracyM: &accuracy,
	}); !errors.Is(err, errOutsideGeofence) {
		t.Fatalf("location beyond GPS uncertainty of the geofence should be rejected, got %v", err)
	}
}

func TestValidateAttendanceLocationAccepts160mAccuracyWithinLargeGeofence(t *testing.T) {
	latitude, longitude, accuracy := 0.0454, 0.0, 160.0
	branchLatitude, branchLongitude := 0.0, 0.0
	branch := models.Branch{Latitude: &branchLatitude, Longitude: &branchLongitude, GeofenceRadiusM: 5000}

	if _, err := validateAttendanceLocation(branch, attendanceLocationInput{
		Latitude: &latitude, Longitude: &longitude, AccuracyM: &accuracy,
	}); err != nil {
		t.Fatalf("location within GPS uncertainty of a 5 km geofence should be accepted: %v", err)
	}

	latitude = 0.046
	if _, err := validateAttendanceLocation(branch, attendanceLocationInput{
		Latitude: &latitude, Longitude: &longitude, AccuracyM: &accuracy,
	}); !errors.Is(err, errOutsideGeofence) {
		t.Fatalf("location outside the capped uncertainty allowance should be rejected, got %v", err)
	}
}

func TestValidateAttendanceLocationRequiresConfiguredBranchAndAccurateGPS(t *testing.T) {
	latitude, longitude, accuracy := 0.0, 0.0, 201.0
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

func TestAttendanceDateUsesBranchTimezone(t *testing.T) {
	value := time.Date(2026, 5, 12, 16, 30, 0, 0, time.UTC)
	jakarta := testTimezone(t, "Asia/Jakarta")
	makassar := testTimezone(t, "Asia/Makassar")

	if got, want := attendanceDateAt(value, jakarta), "2026-05-12"; got != want {
		t.Errorf("Jakarta attendance date = %q, want %q", got, want)
	}
	if got, want := attendanceDateAt(value, makassar), "2026-05-13"; got != want {
		t.Errorf("Makassar attendance date = %q, want %q", got, want)
	}
}

func TestEmployeeAttendanceStatusUsesBranchTimezone(t *testing.T) {
	clockIn := time.Date(2026, 5, 12, 1, 1, 0, 0, time.UTC)
	jakarta := testTimezone(t, "Asia/Jakarta")
	makassar := testTimezone(t, "Asia/Makassar")

	if got := employeeAttendanceStatus("08:00 – 16:00", clockIn, jakarta); got != "Terlambat" {
		t.Errorf("Jakarta attendance status = %q, want Terlambat", got)
	}
	if got := employeeAttendanceStatus("09:00 – 17:00", clockIn, makassar); got != "Terlambat" {
		t.Errorf("Makassar attendance status = %q, want Terlambat", got)
	}
}

func testTimezone(t *testing.T, name string) *time.Location {
	t.Helper()
	location, err := utils.LoadTimezone(name)
	if err != nil {
		t.Fatalf("LoadTimezone(%q): %v", name, err)
	}
	return location
}

func TestApplyBranchTimezoneDefaultsAndValidates(t *testing.T) {
	var created models.Branch
	if err := applyBranchTimezone(&created, "", true); err != nil {
		t.Fatalf("applyBranchTimezone() error = %v", err)
	}
	if created.Timezone != utils.DefaultTimezone {
		t.Errorf("new branch timezone = %q, want %q", created.Timezone, utils.DefaultTimezone)
	}

	existing := models.Branch{Timezone: "Asia/Makassar"}
	if err := applyBranchTimezone(&existing, "", false); err != nil {
		t.Fatalf("applyBranchTimezone() error = %v", err)
	}
	if existing.Timezone != "Asia/Makassar" {
		t.Errorf("omitted timezone changed existing timezone to %q", existing.Timezone)
	}

	if err := applyBranchTimezone(&existing, "Not/AZone", false); err == nil {
		t.Fatal("expected invalid IANA timezone to be rejected")
	}
	if err := applyBranchTimezone(&existing, "Asia/Jayapura", false); err != nil {
		t.Fatalf("valid timezone rejected: %v", err)
	}
	if existing.Timezone != "Asia/Jayapura" {
		t.Errorf("updated branch timezone = %q, want Asia/Jayapura", existing.Timezone)
	}
}
