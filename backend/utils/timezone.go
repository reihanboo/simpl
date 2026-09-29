package utils

import (
	"time"

	_ "time/tzdata"
)

const DefaultTimezone = "Asia/Jakarta"

func LoadTimezone(name string) (*time.Location, error) {
	if name == "" {
		name = DefaultTimezone
	}
	return time.LoadLocation(name)
}
