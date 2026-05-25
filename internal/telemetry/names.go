package telemetry

import (
	"errors"
	"strings"
)

var reservedPrefixes = []string{
	"http.",
	"graphql.",
	"runtime.",
	"flow.",
	"external.",
	"scheduler.",
	"outbox.",
	"saga.",
}

var ErrReservedMetric = errors.New("telemetry: metric name uses reserved namespace")

func ValidateUserMetric(name string) error {
	n := strings.TrimSpace(name)
	if n == "" {
		return errors.New("telemetry: empty metric name")
	}
	check := n
	if strings.HasPrefix(check, "custom.") {
		check = strings.TrimPrefix(check, "custom.")
	}
	lower := strings.ToLower(check)
	for _, p := range reservedPrefixes {
		if strings.HasPrefix(lower, p) {
			return ErrReservedMetric
		}
	}
	return nil
}

func NormalizeCustom(name string) string {
	n := strings.TrimSpace(name)
	if n == "" {
		return n
	}
	if strings.HasPrefix(n, "custom.") {
		return n
	}
	return "custom." + n
}
