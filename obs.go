package fookie

import (
	"context"
	"log/slog"
	"os"
	"time"

	"github.com/fookiejs/fookie/internal/telemetry"
	"go.opentelemetry.io/otel/metric"
)

// flog is the package-level structured logger used by fookie subsystems.
//
// Callers that want a different writer or extra attributes can replace this
// before calling App.Run():
//
//	fookie.SetLogger(slog.New(slog.NewJSONHandler(myWriter, nil)))
var flog = slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
	Level: slog.LevelDebug,
}))

// SetLogger replaces the package-level logger used by all fookie subsystems.
// Must be called before App.Run().
func SetLogger(l *slog.Logger) { flog = l }

type TelemetryConfig struct {
	Enabled      bool
	Metrics      bool
	Traces       bool
	ServiceName  string
	OTLPEndpoint string
}

func TelemetryConfigFromEnv() TelemetryConfig {
	c := telemetry.ConfigFromEnv()
	return TelemetryConfig{
		Enabled:      c.Enabled,
		Metrics:      c.Metrics,
		Traces:       c.Traces,
		ServiceName:  c.ServiceName,
		OTLPEndpoint: c.OTLPEndpoint,
	}
}

func InitTelemetry(cfg TelemetryConfig) error {
	return telemetry.Init(telemetry.Config{
		Enabled:      cfg.Enabled,
		Metrics:      cfg.Metrics,
		Traces:       cfg.Traces,
		ServiceName:  cfg.ServiceName,
		OTLPEndpoint: cfg.OTLPEndpoint,
	})
}

func BindMeterProviderForTest(mp metric.MeterProvider) {
	telemetry.BindMeterProviderForTest(mp)
}

func ResetTelemetryForTest() {
	telemetry.SetNoopProvidersForTest()
}

func ShutdownTelemetry(ctx context.Context) error {
	return telemetry.Shutdown(ctx)
}

// Stable field keys used across all log events. Consumers can rely on these
// names being constant across releases.
const (
	flogService    = "service"
	flogEntityID   = "entity_id"
	flogModel      = "model"
	flogCallKey    = "call_key"
	flogCompensate = "compensate"
	flogStepCount  = "step_count"
	flogDurationMs = "duration_ms"
	flogReason     = "reason"
	flogAttempts   = "attempts"
	flogErr        = "err"
)

// msElapsed returns milliseconds elapsed since start as a float64, giving
// sub-millisecond precision (e.g., 1.234).
func msElapsed(start time.Time) float64 {
	return float64(time.Since(start).Microseconds()) / 1_000.0
}
