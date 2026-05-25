package fookie

import (
	"io"
	"log/slog"
	"os"
	"time"

	"github.com/fookiejs/fookie/internal/telemetry"
)

// flog is the package-level structured logger. Every fookie event is emitted as
// a JSON line to stdout so that operators can parse, forward, or ignore them
// without any exporter dependency.
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

func SetTelemetryOutput(w io.Writer) { telemetry.SetOutput(w) }

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
