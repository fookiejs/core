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
	check := strings.TrimPrefix(n, "custom.")
	lower := strings.ToLower(check)
	for _, p := range reservedPrefixes {
		if strings.HasPrefix(lower, p) {
			return ErrReservedMetric
		}
	}
	return nil
}

func NormalizeCustom(name string) string {
	metricName := strings.TrimSpace(name)
	if metricName == "" {
		return metricName
	}
	if strings.HasPrefix(metricName, "custom.") {
		return metricName
	}
	return "custom." + metricName
}
