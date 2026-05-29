package telemetry

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetricgrpc"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	noopmetric "go.opentelemetry.io/otel/metric/noop"
	"go.opentelemetry.io/otel/propagation"
	sdkmetric "go.opentelemetry.io/otel/sdk/metric"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.26.0"
	nooptrace "go.opentelemetry.io/otel/trace/noop"
)

var (
	initOnce   sync.Once
	shutdownFn func(context.Context) error
)

func Init(config Config) error {
	initOnce.Do(func() {
		bootstrap(config)
	})
	return nil
}

func Shutdown(ctx context.Context) error {
	if shutdownFn == nil {
		return nil
	}
	return shutdownFn(ctx)
}

func bootstrap(config Config) {
	setNoopProviders()

	if !config.Enabled {
		initRuntimeMetrics()
		shutdownFn = func(context.Context) error { return nil }
		return
	}

	if config.OTLPEndpoint == "" {
		initRuntimeMetrics()
		shutdownFn = func(context.Context) error { return nil }
		return
	}

	serviceName := config.ServiceName
	if serviceName == "" {
		serviceName = defaultServiceName
	}

	res, err := resource.Merge(
		resource.Default(),
		resource.NewWithAttributes(
			semconv.SchemaURL,
			semconv.ServiceName(serviceName),
		),
	)
	if err != nil {
		debugLog("resource", err)
		initRuntimeMetrics()
		shutdownFn = func(context.Context) error { return nil }
		return
	}

	var shutdowns []func(context.Context) error
	host := otlpHost(config.OTLPEndpoint)

	if config.Metrics {
		exp, err := newMetricExporter(host)
		if err != nil {
			debugLog("metric exporter", err)
		} else {
			mp := sdkmetric.NewMeterProvider(
				sdkmetric.WithResource(res),
				sdkmetric.WithReader(sdkmetric.NewPeriodicReader(exp, sdkmetric.WithInterval(15*time.Second))),
			)
			otel.SetMeterProvider(mp)
			shutdowns = append(shutdowns, mp.Shutdown)
		}
	}

	if config.Traces {
		exp, err := newTraceExporter(host)
		if err != nil {
			debugLog("trace exporter", err)
		} else {
			tp := sdktrace.NewTracerProvider(
				sdktrace.WithResource(res),
				sdktrace.WithBatcher(exp),
			)
			otel.SetTracerProvider(tp)
			shutdowns = append(shutdowns, tp.Shutdown)
		}
	}

	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
		propagation.TraceContext{},
		propagation.Baggage{},
	))

	metricsMu.Lock()
	metricsReady = false
	metricsMu.Unlock()
	initRuntimeMetrics()

	shutdownFn = func(ctx context.Context) error {
		var last error
		for _, callback := range shutdowns {
			if err := callback(ctx); err != nil {
				last = err
			}
		}
		return last
	}
}

func setNoopProviders() {
	otel.SetMeterProvider(noopmetric.NewMeterProvider())
	otel.SetTracerProvider(nooptrace.NewTracerProvider())
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator())
}

func newMetricExporter(host string) (sdkmetric.Exporter, error) {
	opts := []otlpmetricgrpc.Option{otlpmetricgrpc.WithInsecure()}
	if host != "" {
		opts = append(opts, otlpmetricgrpc.WithEndpoint(host))
	}
	exp, err := otlpmetricgrpc.New(context.Background(), opts...)
	if err != nil {
		return nil, fmt.Errorf("otlp metric exporter: %w", err)
	}
	return exp, nil
}

func newTraceExporter(host string) (sdktrace.SpanExporter, error) {
	opts := []otlptracegrpc.Option{otlptracegrpc.WithInsecure()}
	if host != "" {
		opts = append(opts, otlptracegrpc.WithEndpoint(host))
	}
	exp, err := otlptracegrpc.New(context.Background(), opts...)
	if err != nil {
		return nil, fmt.Errorf("otlp trace exporter: %w", err)
	}
	return exp, nil
}

func otlpHost(endpoint string) string {
	trimmedEndpoint := strings.TrimSpace(endpoint)
	trimmedEndpoint = strings.TrimPrefix(trimmedEndpoint, "https://")
	trimmedEndpoint = strings.TrimPrefix(trimmedEndpoint, "http://")
	if i := strings.IndexByte(trimmedEndpoint, '/'); i >= 0 {
		trimmedEndpoint = trimmedEndpoint[:i]
	}
	return trimmedEndpoint
}

func debugLog(phase string, err error) {
	slog.Debug("telemetry", "phase", phase, "err", err.Error())
}

func bestEffort(callback func()) {
	defer func() { _ = recover() }()
	callback()
}
