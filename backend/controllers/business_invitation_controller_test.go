package controllers

import "testing"

func TestInvitationEmailMatchesAuthenticatedUser(t *testing.T) {
	tests := []struct {
		name        string
		invited     string
		user        string
		wantMatches bool
	}{
		{name: "exact match", invited: "owner@example.com", user: "owner@example.com", wantMatches: true},
		{name: "case insensitive", invited: "Owner@Example.com", user: "owner@example.COM", wantMatches: true},
		{name: "ignores surrounding whitespace", invited: " owner@example.com ", user: "owner@example.com", wantMatches: true},
		{name: "different address", invited: "other@example.com", user: "owner@example.com", wantMatches: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := invitationEmailMatches(tt.invited, tt.user); got != tt.wantMatches {
				t.Errorf("invitationEmailMatches(%q, %q) = %v, want %v", tt.invited, tt.user, got, tt.wantMatches)
			}
		})
	}
}
