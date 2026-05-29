package observability

import (
	"log/slog"
	"os"
	"time"
)

var flog = slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
	Level: slog.LevelDebug,
}))

func SetLogger(l *slog.Logger) { flog = l }

const (
	ServiceKey    = "service"
	EntityIDKey   = "entity_id"
	ModelKey      = "model"
	ExternalID    = "external_id"
	CompensateKey = "compensate"
	StepCountKey  = "step_count"
	DurationMsKey = "duration_ms"
	ReasonKey     = "reason"
	AttemptsKey   = "attempts"
	ErrKey        = "err"
)

func Info(msg string, args ...any)  { flog.Info(msg, args...) }
func Warn(msg string, args ...any)  { flog.Warn(msg, args...) }
func Debug(msg string, args ...any) { flog.Debug(msg, args...) }
func Error(msg string, args ...any) { flog.Error(msg, args...) }

func MsElapsed(start time.Time) float64 {
	return float64(time.Since(start).Microseconds()) / 1_000.0
}
