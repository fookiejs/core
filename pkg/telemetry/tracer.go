package telemetry

import (
	"context"
	cryptorand "crypto/rand"
	"os"
	"strconv"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.26.0"
	"go.opentelemetry.io/otel/trace"
)

// fullHexIDGenerator ensures trace IDs always have a non-zero high nibble so
// Tempo (which serialises IDs as integers) never produces a 31-char hex string
// that Grafana's Tempo plugin rejects.
type fullHexIDGenerator struct{}

func (g *fullHexIDGenerator) NewIDs(ctx context.Context) (trace.TraceID, trace.SpanID) {
	var tid trace.TraceID
	var sid trace.SpanID
	_, _ = cryptorand.Read(tid[:])
	_, _ = cryptorand.Read(sid[:])
	tid[0] |= 0x80 // pin MSB → first nibble is always 8–F
	return tid, sid
}

func (g *fullHexIDGenerator) NewSpanID(ctx context.Context, traceID trace.TraceID) trace.SpanID {
	var sid trace.SpanID
	_, _ = cryptorand.Read(sid[:])
	return sid
}

const instrumentationName = "fookie"

func InitTracer(ctx context.Context, serviceName string) (func(context.Context) error, error) {
	endpoint := os.Getenv("OTLP_ENDPOINT")
	if endpoint == "" {
		// No OTLP endpoint configured — install a noop provider so spans are
		// created (zero overhead) but nothing is exported.
		otel.SetTracerProvider(trace.NewNoopTracerProvider())
		return func(context.Context) error { return nil }, nil
	}

	exporter, err := otlptracehttp.New(ctx,
		otlptracehttp.WithEndpoint(endpoint),
		otlptracehttp.WithInsecure(),
	)
	if err != nil {
		return nil, err
	}

	res, err := resource.New(ctx,
		resource.WithAttributes(semconv.ServiceName(serviceName)),
	)
	if err != nil {
		return nil, err
	}

	// Trace sampling: TRACE_SAMPLE_RATE env var (0.0-1.0, default 0.1 for production)
	sampleRate := 0.1
	if rate := os.Getenv("TRACE_SAMPLE_RATE"); rate != "" {
		if parsed, err := strconv.ParseFloat(rate, 64); err == nil && parsed >= 0 && parsed <= 1 {
			sampleRate = parsed
		}
	}
	sampler := sdktrace.TraceIDRatioBased(sampleRate)

	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exporter),
		sdktrace.WithResource(res),
		sdktrace.WithSampler(sampler),
		sdktrace.WithIDGenerator(&fullHexIDGenerator{}),
	)
	otel.SetTracerProvider(tp)

	return tp.Shutdown, nil
}

func Tracer() trace.Tracer {
	return otel.Tracer(instrumentationName)
}
