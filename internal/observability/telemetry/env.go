package telemetry

import (
	"os"
)

func envTruthy(key string) bool {
	v := os.Getenv(key)
	return v == "1" || v == envTrue
}

func ConfigFromEnv() Config {
	enabled := envTruthy("OTEL_ENABLED") || envTruthy("TELEMETRY_ENABLED")
	metrics := enabled
	traces := enabled
	if v := os.Getenv("OTEL_METRICS"); v != "" {
		metrics = v == "1" || v == envTrue
	}
	if v := os.Getenv("OTEL_TRACES"); v != "" {
		traces = v == "1" || v == envTrue
	}
	endpoint := os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
	if endpoint == "" {
		endpoint = os.Getenv("TELEMETRY_OTLP_ENDPOINT")
	}
	svc := os.Getenv("OTEL_SERVICE_NAME")
	if svc == "" {
		svc = defaultServiceName
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
