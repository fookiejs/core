package telemetry

import (
	"testing"
)

func TestConfigFromEnvDefaults(t *testing.T) {
	t.Setenv("OTEL_ENABLED", "")
	t.Setenv("TELEMETRY_ENABLED", "")
	cfg := ConfigFromEnv()
	if cfg.Enabled {
		t.Fatal("expected disabled")
	}
	if cfg.ServiceName != "fookie" {
		t.Fatalf("service=%q", cfg.ServiceName)
	}
}

func TestConfigFromEnvTruthy(t *testing.T) {
	t.Setenv("OTEL_ENABLED", "true")
	t.Setenv("OTEL_EXPORTER_OTLP_ENDPOINT", "localhost:4317")
	cfg := ConfigFromEnv()
	if !cfg.Enabled {
		t.Fatal("expected enabled")
	}
	if !cfg.Metrics || !cfg.Traces {
		t.Fatal("expected metrics and traces enabled")
	}
}

func TestBootstrapNoEndpoint(t *testing.T) {
	setNoopProviders()
	bootstrap(Config{Enabled: true, Metrics: true, Traces: true})
	if shutdownFn == nil {
		t.Fatal("expected shutdown fn")
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
