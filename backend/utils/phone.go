package utils

import (
	"regexp"
	"strings"
)

var (
	phoneSeparators       = regexp.MustCompile(`[[:space:]()-]`)
	indonesianMobilePhone = regexp.MustCompile(`^(?:\+62|62|0)8[1-9][0-9]{7,10}$`)
)

// IsValidIndonesianMobilePhone validates Indonesian mobile numbers in local or
// international format, allowing common visual separators.
func IsValidIndonesianMobilePhone(phone string) bool {
	normalized := phoneSeparators.ReplaceAllString(strings.TrimSpace(phone), "")
	return indonesianMobilePhone.MatchString(normalized)
}
