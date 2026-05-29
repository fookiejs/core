package telemetry

import (
	"testing"
)

func TestConfigFromEnvDefaults(t *testing.T) {
	t.Setenv("OTEL_ENABLED", "")
	t.Setenv("TELEMETRY_ENABLED", "")
	config := ConfigFromEnv()
	if config.Enabled {
		t.Fatal("expected disabled")
	}
	if config.ServiceName != "fookie" {
		t.Fatalf("service=%q", config.ServiceName)
	}
}

func TestConfigFromEnvTruthy(t *testing.T) {
	t.Setenv("OTEL_ENABLED", "true")
	t.Setenv("OTEL_EXPORTER_OTLP_ENDPOINT", "localhost:4317")
	config := ConfigFromEnv()
	if !config.Enabled {
		t.Fatal("expected enabled")
	}
	if !config.Metrics || !config.Traces {
		t.Fatal("expected metrics and traces enabled")
	}
}

func TestBootstrapNoEndpoint(t *testing.T) {
	setNoopProviders()
	bootstrap(Config{Enabled: true, Metrics: true, Traces: true})
	if shutdownFn == nil {
		t.Fatal("expected shutdown callback")
	}
}

func TestBootstrapDisabled(t *testing.T) {
	setNoopProviders()
	bootstrap(Config{Enabled: false})
}

func TestOtlpHost(t *testing.T) {
	if otlpHost("https://collector:4317/v1/traces") != "collector:4317" {
		t.Fatal("unexpected host parse")
	}
	if otlpHost("http://localhost:4317") != "localhost:4317" {
		t.Fatal("unexpected host parse")
	}
}
