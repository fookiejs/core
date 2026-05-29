package telemetry

import (
	"context"
	"sync"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/metric"
)

const meterName = "github.com/fookiejs/fookie"

var (
	metricsMu    sync.Mutex
	metricsReady bool

	flowStarted       metric.Int64Counter
	flowCompleted     metric.Int64Counter
	flowFailed        metric.Int64Counter
	externalStarted   metric.Int64Counter
	externalCompleted metric.Int64Counter
	externalFailed    metric.Int64Counter
	externalRetry     metric.Int64Counter
	schedulerRetry    metric.Int64Counter
	schedulerDepth    metric.Float64Gauge
	graphqlDuration   metric.Float64Histogram
	graphqlFailed     metric.Int64Counter
	graphqlReceived   metric.Int64Counter
	outboxDuration    metric.Float64Histogram
	outboxProcessed   metric.Int64Counter

	userCounters   sync.Map
	userHistograms sync.Map
	userGauges     sync.Map
)

func initRuntimeMetrics() {
	metricsMu.Lock()
	defer metricsMu.Unlock()
	if metricsReady {
		return
	}
	m := otel.Meter(meterName)
	flowStarted, _ = m.Int64Counter("flow.execution.started")
	flowCompleted, _ = m.Int64Counter("flow.execution.completed")
	flowFailed, _ = m.Int64Counter("flow.execution.failed")
	externalStarted, _ = m.Int64Counter("external.call.started")
	externalCompleted, _ = m.Int64Counter("external.call.completed")
	externalFailed, _ = m.Int64Counter("external.call.failed")
	externalRetry, _ = m.Int64Counter("external.call.retry")
	schedulerRetry, _ = m.Int64Counter("scheduler.retry")
	schedulerDepth, _ = m.Float64Gauge("scheduler.queue.depth")
	graphqlDuration, _ = m.Float64Histogram("graphql.request.duration")
	graphqlFailed, _ = m.Int64Counter("graphql.request.failed")
	graphqlReceived, _ = m.Int64Counter("graphql.request.received")
	outboxDuration, _ = m.Float64Histogram("runtime.outbox.duration")
	outboxProcessed, _ = m.Int64Counter("runtime.outbox.processed")
	metricsReady = true
}

func ResetInstrumentsForTest() {
	resetRuntimeMetricsForTest()
}

func resetRuntimeMetricsForTest() {
	metricsMu.Lock()
	metricsReady = false
	metricsMu.Unlock()
	userCounters = sync.Map{}
	userHistograms = sync.Map{}
	userGauges = sync.Map{}
	initRuntimeMetrics()
}

func BindMeterProvider(provider metric.MeterProvider) {
	BindMeterProviderForTest(provider)
}

func EmitCounter(ctx context.Context, name string, attrs map[string]string) {
	emitCounter(ctx, name, attrs)
}

func EmitHistogram(ctx context.Context, name string, value float64, attrs map[string]string) {
	emitHistogram(ctx, name, value, attrs)
}

func EmitGauge(ctx context.Context, name string, value float64, attrs map[string]string) {
	emitUserGauge(ctx, name, value, attrs)
}

func addCounter(ctx context.Context, c metric.Int64Counter, attrs map[string]string) {
	if c == nil {
		return
	}
	if ctx == nil {
		ctx = context.Background()
	}
	bestEffort(func() {
		c.Add(ctx, 1, metric.WithAttributes(attrsToOTel(sanitizeAttrs(attrs))...))
	})
}

func recordHistogram(ctx context.Context, h metric.Float64Histogram, value float64, attrs map[string]string) {
	if h == nil {
		return
	}
	if ctx == nil {
		ctx = context.Background()
	}
	bestEffort(func() {
		h.Record(ctx, value, metric.WithAttributes(attrsToOTel(sanitizeAttrs(attrs))...))
	})
}

func recordGauge(ctx context.Context, g metric.Float64Gauge, value float64, attrs map[string]string) {
	if g == nil {
		return
	}
	if ctx == nil {
		ctx = context.Background()
	}
	bestEffort(func() {
		g.Record(ctx, value, metric.WithAttributes(attrsToOTel(sanitizeAttrs(attrs))...))
	})
}

func emitCounter(ctx context.Context, name string, attrs map[string]string) {
	switch name {
	case "flow.execution.started":
		addCounter(ctx, flowStarted, attrs)
	case "flow.execution.completed":
		addCounter(ctx, flowCompleted, attrs)
	case "flow.execution.failed":
		addCounter(ctx, flowFailed, attrs)
	case "external.call.started":
		addCounter(ctx, externalStarted, attrs)
	case "external.call.completed":
		addCounter(ctx, externalCompleted, attrs)
	case "external.call.failed":
		addCounter(ctx, externalFailed, attrs)
	case "external.call.retry":
		addCounter(ctx, externalRetry, attrs)
	case "scheduler.retry":
		addCounter(ctx, schedulerRetry, attrs)
	case "graphql.request.failed":
		addCounter(ctx, graphqlFailed, attrs)
	case "graphql.request.received":
		addCounter(ctx, graphqlReceived, attrs)
	case "runtime.outbox.processed":
		addCounter(ctx, outboxProcessed, attrs)
	default:
		emitUserCounter(ctx, name, attrs)
	}
}

func emitHistogram(ctx context.Context, name string, value float64, attrs map[string]string) {
	switch name {
	case "graphql.request.duration":
		recordHistogram(ctx, graphqlDuration, value, attrs)
	case "runtime.outbox.duration":
		recordHistogram(ctx, outboxDuration, value, attrs)
	case "scheduler.queue.depth":
		recordGauge(ctx, schedulerDepth, value, attrs)
	default:
		emitUserHistogram(ctx, name, value, attrs)
	}
}

func emitUserCounter(ctx context.Context, name string, attrs map[string]string) {
	if err := ValidateUserMetric(name); err != nil {
		return
	}
	full := NormalizeCustom(name)
	v, _ := userCounters.LoadOrStore(full, func() metric.Int64Counter {
		c, _ := otel.Meter(meterName).Int64Counter(full)
		return c
	}())
	addCounter(ctx, v.(metric.Int64Counter), attrs)
}

func emitUserHistogram(ctx context.Context, name string, value float64, attrs map[string]string) {
	if err := ValidateUserMetric(name); err != nil {
		return
	}
	full := NormalizeCustom(name)
	v, _ := userHistograms.LoadOrStore(full, func() metric.Float64Histogram {
		h, _ := otel.Meter(meterName).Float64Histogram(full)
		return h
	}())
	recordHistogram(ctx, v.(metric.Float64Histogram), value, attrs)
}

func emitUserGauge(ctx context.Context, name string, value float64, attrs map[string]string) {
	if err := ValidateUserMetric(name); err != nil {
		return
	}
	full := NormalizeCustom(name)
	v, _ := userGauges.LoadOrStore(full, func() metric.Float64Gauge {
		g, _ := otel.Meter(meterName).Float64Gauge(full)
		return g
	}())
	recordGauge(ctx, v.(metric.Float64Gauge), value, attrs)
}

func GraphQLReceived(ctx context.Context, operation string) {
	attrs := map[string]string{}
	if operation != "" {
		attrs["operation"] = operation
	}
	addCounter(ctx, graphqlReceived, attrs)
}

func GraphQLDuration(ctx context.Context, operation string, ms float64) {
	attrs := map[string]string{}
	if operation != "" {
		attrs["operation"] = operation
	}
	recordHistogram(ctx, graphqlDuration, ms, attrs)
}

func GraphQLFailed(ctx context.Context, operation string) {
	attrs := map[string]string{}
	if operation != "" {
		attrs["operation"] = operation
	}
	addCounter(ctx, graphqlFailed, attrs)
}

func OutboxDuration(ctx context.Context, service, result string, ms float64) {
	recordHistogram(ctx, outboxDuration, ms, map[string]string{attrService: service, "result": result})
}

func OutboxProcessed(ctx context.Context, service string) {
	addCounter(ctx, outboxProcessed, map[string]string{attrService: service})
}
