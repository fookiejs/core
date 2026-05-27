package telemetry

import (
	"os"
)

func ConfigFromEnv() Config {
	enabled := os.Getenv("OTEL_ENABLED") == "1" || os.Getenv("OTEL_ENABLED") == "true" ||
		os.Getenv("TELEMETRY_ENABLED") == "1" || os.Getenv("TELEMETRY_ENABLED") == "true"
	metrics := enabled
	traces := enabled
	if v := os.Getenv("OTEL_METRICS"); v != "" {
		metrics = v == "1" || v == "true"
	}
	if v := os.Getenv("OTEL_TRACES"); v != "" {
		traces = v == "1" || v == "true"
	}
	endpoint := os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
	if endpoint == "" {
		endpoint = os.Getenv("TELEMETRY_OTLP_ENDPOINT")
	}
	svc := os.Getenv("OTEL_SERVICE_NAME")
	if svc == "" {
		svc = "fookie"
	}
	return Config{
		Enabled:      enabled,
		Metrics:      metrics,
		Traces:       traces,
		ServiceName:  svc,
		OTLPEndpoint: endpoint,
		OTLPProtocol: os.Getenv("OTEL_EXPORTER_OTLP_PROTOCOL"),
	}
}
