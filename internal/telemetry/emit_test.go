package telemetry

import (
	"context"
	"testing"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	sdkmetric "go.opentelemetry.io/otel/sdk/metric"
	"go.opentelemetry.io/otel/sdk/metric/metricdata"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/sdk/trace/tracetest"
)

func setupTestMetrics(t *testing.T) *sdkmetric.ManualReader {
	t.Helper()
	reader := sdkmetric.NewManualReader()
	BindMeterProviderForTest(sdkmetric.NewMeterProvider(sdkmetric.WithReader(reader)))
	t.Cleanup(func() {
		setNoopProviders()
	})
	return reader
}

func setupTestTraces(t *testing.T) *tracetest.SpanRecorder {
	t.Helper()
	sr := tracetest.NewSpanRecorder()
	BindTracerProviderForTest(sdktrace.NewTracerProvider(sdktrace.WithSpanProcessor(sr)))
	t.Cleanup(func() {
		setNoopProviders()
	})
	return sr
}

func TestEmitCounterRuntime(t *testing.T) {
	reader := setupTestMetrics(t)
	EmitCounter(context.Background(), "flow.execution.started", map[string]string{"model": "User"})
	var rm metricdata.ResourceMetrics
	if err := reader.Collect(context.Background(), &rm); err != nil {
		t.Fatal(err)
	}
	if len(rm.ScopeMetrics) == 0 || len(rm.ScopeMetrics[0].Metrics) == 0 {
		t.Fatal("expected metric data")
	}
}

func TestEmitGaugeSnapshot(t *testing.T) {
	reader := setupTestMetrics(t)
	EmitHistogram(context.Background(), "scheduler.queue.depth", 42, nil)
	var rm metricdata.ResourceMetrics
	if err := reader.Collect(context.Background(), &rm); err != nil {
		t.Fatal(err)
	}
	if len(rm.ScopeMetrics) == 0 {
		t.Fatal("expected gauge data")
	}
}

func TestEmitTraceShape(t *testing.T) {
	sr := setupTestTraces(t)
	EmitTrace(context.Background(), "external.PayGateway", "external.completed", map[string]string{"service": "PayGateway"})
	spans := sr.Ended()
	if len(spans) != 1 {
		t.Fatalf("spans=%d", len(spans))
	}
	if spans[0].Name() != "external.PayGateway" {
		t.Fatalf("name=%q", spans[0].Name())
	}
}

func TestFlowStartedMetric(t *testing.T) {
	reader := setupTestMetrics(t)
	FlowStarted(context.Background(), "Transaction", "ent_1")
	var rm metricdata.ResourceMetrics
	if err := reader.Collect(context.Background(), &rm); err != nil {
		t.Fatal(err)
	}
	found := false
	for _, sm := range rm.ScopeMetrics {
		for _, m := range sm.Metrics {
			if m.Name == "flow.execution.started" {
				found = true
			}
		}
	}
	if !found {
		t.Fatal("flow.execution.started not found")
	}
}

func TestCustomCounter(t *testing.T) {
	reader := setupTestMetrics(t)
	EmitCounter(context.Background(), "custom.order.created", map[string]string{"model": "Order"})
	var rm metricdata.ResourceMetrics
	if err := reader.Collect(context.Background(), &rm); err != nil {
		t.Fatal(err)
	}
	found := false
	for _, sm := range rm.ScopeMetrics {
		for _, m := range sm.Metrics {
			if m.Name == "custom.order.created" {
				found = true
			}
		}
	}
	if !found {
		t.Fatal("custom.order.created not found")
	}
}

func TestExternalStartedSpan(t *testing.T) {
	sr := setupTestTraces(t)
	ctx := ExternalStarted(context.Background(), "PayGateway", "Transaction", "ent_1", map[string]string{"call_key": "ck"})
	endSpan(trace.SpanFromContext(ctx), nil)
	spans := sr.Ended()
	if len(spans) != 1 {
		t.Fatalf("spans=%d", len(spans))
	}
	if spans[0].Name() != "external.PayGateway" {
		t.Fatalf("name=%q", spans[0].Name())
	}
	attrs := spans[0].Attributes()
	hasService := false
	for _, a := range attrs {
		if a.Key == attribute.Key("service") && a.Value.AsString() == "PayGateway" {
			hasService = true
		}
	}
	if !hasService {
		t.Fatal("service attribute missing")
	}
}

func TestInitDisabledNoop(t *testing.T) {
	err := Init(Config{Enabled: false})
	if err != nil {
		t.Fatal(err)
	}
	EmitCounter(context.Background(), "flow.execution.started", nil)
	EmitTrace(context.Background(), "flow.Test", "flow.started", nil)
}
