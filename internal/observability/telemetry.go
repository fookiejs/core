package observability

import (
	"context"
	"fmt"

	"github.com/fookiejs/fookie/internal/observability/telemetry"
	"go.opentelemetry.io/otel/metric"
)

type Config struct {
	Enabled      bool
	Metrics      bool
	Traces       bool
	ServiceName  string
	OTLPEndpoint string
}

func ConfigFromEnv() Config {
	config := telemetry.ConfigFromEnv()
	return Config{
		Enabled:      config.Enabled,
		Metrics:      config.Metrics,
		Traces:       config.Traces,
		ServiceName:  config.ServiceName,
		OTLPEndpoint: config.OTLPEndpoint,
	}
}

func TelemetryConfigFromInternal(enabled, metrics, traces bool, serviceName, endpoint string) Config {
	return Config{
		Enabled:      enabled,
		Metrics:      metrics,
		Traces:       traces,
		ServiceName:  serviceName,
		OTLPEndpoint: endpoint,
	}
}

func InitTelemetry(config Config) error {
	if err := telemetry.Init(telemetry.Config{
		Enabled:      config.Enabled,
		Metrics:      config.Metrics,
		Traces:       config.Traces,
		ServiceName:  config.ServiceName,
		OTLPEndpoint: config.OTLPEndpoint,
	}); err != nil {
		return fmt.Errorf("telemetry init: %w", err)
	}
	return nil
}

func BindMeterProviderForTest(mp metric.MeterProvider) {
	telemetry.BindMeterProviderForTest(mp)
}

func ShutdownTelemetry(ctx context.Context) error {
	if err := telemetry.Shutdown(ctx); err != nil {
		return fmt.Errorf("telemetry shutdown: %w", err)
	}
	return nil
}

func TraceID(ctx context.Context) string { return telemetry.TraceID(ctx) }

func FlowStarted(ctx context.Context, model, entityID string) context.Context {
	return telemetry.FlowStarted(ctx, model, entityID)
}

func FlowCompleted(ctx context.Context, model, entityID string) {
	telemetry.FlowCompleted(ctx, model, entityID)
}

func FlowFailed(ctx context.Context, model, entityID, reason string) {
	telemetry.FlowFailed(ctx, model, entityID, reason)
}

func FlowSuspended(ctx context.Context, model, entityID string, extra map[string]string) {
	telemetry.FlowSuspended(ctx, model, entityID, extra)
}

func FlowResumed(ctx context.Context, model, entityID string) context.Context {
	return telemetry.FlowResumed(ctx, model, entityID)
}

func ExternalStarted(ctx context.Context, service, model, entityID string, extra map[string]string) context.Context {
	return telemetry.ExternalStarted(ctx, service, model, entityID, extra)
}

func ExternalCompleted(ctx context.Context, service, model, entityID string, extra map[string]string) {
	telemetry.ExternalCompleted(ctx, service, model, entityID, extra)
}

func ExternalFailed(ctx context.Context, service, model, entityID string, extra map[string]string) {
	telemetry.ExternalFailed(ctx, service, model, entityID, extra)
}

func ExternalPending(ctx context.Context, service, model, entityID string, extra map[string]string) {
	telemetry.ExternalPending(ctx, service, model, entityID, extra)
}

func ExternalRetry(ctx context.Context, service string, extra map[string]string) {
	telemetry.ExternalRetry(ctx, service, extra)
}

func SchedulerRetry(ctx context.Context, service string, extra map[string]string) {
	telemetry.SchedulerRetry(ctx, service, extra)
}

func SchedulerResume(ctx context.Context, model, entityID string) context.Context {
	return telemetry.SchedulerResume(ctx, model, entityID)
}

func GraphQLReceived(ctx context.Context, operation string) {
	telemetry.GraphQLReceived(ctx, operation)
}

func GraphQLDuration(ctx context.Context, operation string, ms float64) {
	telemetry.GraphQLDuration(ctx, operation, ms)
}

func GraphQLFailed(ctx context.Context, operation string) {
	telemetry.GraphQLFailed(ctx, operation)
}

func EmitCounter(ctx context.Context, name string, tags map[string]string) {
	telemetry.EmitCounter(ctx, name, tags)
}

func EmitHistogram(ctx context.Context, name string, value float64, tags map[string]string) {
	telemetry.EmitHistogram(ctx, name, value, tags)
}

func EmitGauge(ctx context.Context, name string, value float64, tags map[string]string) {
	telemetry.EmitGauge(ctx, name, value, tags)
}

func ValidateUserMetric(name string) error { return telemetry.ValidateUserMetric(name) }

func NormalizeCustom(name string) string { return telemetry.NormalizeCustom(name) }
