package telemetry

import (
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/metric"
	"go.opentelemetry.io/otel/trace"
)

func BindMeterProviderForTest(mp metric.MeterProvider) {
	otel.SetMeterProvider(mp)
	ResetInstrumentsForTest()
}

func BindTracerProviderForTest(tp trace.TracerProvider) {
	otel.SetTracerProvider(tp)
}

func SetNoopProvidersForTest() {
	setNoopProviders()
}
