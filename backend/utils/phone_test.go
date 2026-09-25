package utils

import "testing"

func TestIsValidIndonesianMobilePhone(t *testing.T) {
	tests := []struct {
		name  string
		phone string
		valid bool
	}{
		{name: "local format", phone: "081234567890", valid: true},
		{name: "maximum local length", phone: "0812-3456-78901", valid: true},
		{name: "international format", phone: "+6281234567890", valid: true},
		{name: "country code without plus", phone: "6281234567890", valid: true},
		{name: "formatted number", phone: "+62 812-3456-7890", valid: true},
		{name: "landline", phone: "02123456789", valid: false},
		{name: "too short", phone: "081234", valid: false},
		{name: "letters", phone: "0812abc567890", valid: false},
		{name: "plus sign inside number", phone: "0812+3456789", valid: false},
		{name: "invalid country prefix", phone: "+12025550123", valid: false},
		{name: "empty", phone: "", valid: false},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := IsValidIndonesianMobilePhone(test.phone); got != test.valid {
				t.Errorf("IsValidIndonesianMobilePhone(%q) = %t, want %t", test.phone, got, test.valid)
			}
		})
	}
}
