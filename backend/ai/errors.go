package ai

import "errors"

// ErrNotConfigured is returned when no DeepSeek API key is available.
var ErrNotConfigured = errors.New("deepseek api key is not configured")

func errInvalidToolArgument(message string) error {
	return errors.New(message)
}
