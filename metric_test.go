package fookie

import (
	"context"
	"testing"

	"github.com/fookiejs/fookie/internal/telemetry"
	sdkmetric "go.opentelemetry.io/otel/sdk/metric"
	"go.opentelemetry.io/otel/sdk/metric/metricdata"
)

func setupMetricTest(t *testing.T) *sdkmetric.ManualReader {
	t.Helper()
	reader := sdkmetric.NewManualReader()
	telemetry.BindMeterProviderForTest(sdkmetric.NewMeterProvider(sdkmetric.WithReader(reader)))
	return reader
}

func TestFlowMetricIncrement(t *testing.T) {
	reader := setupMetricTest(t)
	m := newFlowMetric(context.Background(), "Transaction", "ent_1")
	m.Increment("order.created", map[string]string{"gateway": "test"})

	var rm metricdata.ResourceMetrics
	if err := reader.Collect(context.Background(), &rm); err != nil {
		t.Fatal(err)
	}
	found := false
	for _, sm := range rm.ScopeMetrics {
		for _, met := range sm.Metrics {
			if met.Name == "custom.order.created" {
				found = true
			}
		}
	}
	if !found {
		t.Fatal("custom.order.created not emitted")
	}
}

func TestFlowMetricRejectsReserved(t *testing.T) {
	setupMetricTest(t)
	m := newFlowMetric(context.Background(), "Transaction", "")
	m.Increment("http.received", nil)
}
