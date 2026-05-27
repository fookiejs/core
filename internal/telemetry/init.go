package telemetry

import (
	"context"
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

func Init(cfg Config) error {
	var initErr error
	initOnce.Do(func() {
		initErr = bootstrap(cfg)
	})
	return initErr
}

func Shutdown(ctx context.Context) error {
	if shutdownFn == nil {
		return nil
	}
	return shutdownFn(ctx)
}

func bootstrap(cfg Config) error {
	setNoopProviders()

	if !cfg.Enabled {
		initRuntimeMetrics()
		shutdownFn = func(context.Context) error { return nil }
		return nil
	}

	if cfg.OTLPEndpoint == "" {
		initRuntimeMetrics()
		shutdownFn = func(context.Context) error { return nil }
		return nil
	}

	serviceName := cfg.ServiceName
	if serviceName == "" {
		serviceName = "fookie"
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
		return nil
	}

	var shutdowns []func(context.Context) error
	host := otlpHost(cfg.OTLPEndpoint)

	if cfg.Metrics {
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

	if cfg.Traces {
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
		for _, fn := range shutdowns {
			if err := fn(ctx); err != nil {
				last = err
			}
		}
		return last
	}
	return nil
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
	return otlpmetricgrpc.New(context.Background(), opts...)
}

func newTraceExporter(host string) (sdktrace.SpanExporter, error) {
	opts := []otlptracegrpc.Option{otlptracegrpc.WithInsecure()}
	if host != "" {
		opts = append(opts, otlptracegrpc.WithEndpoint(host))
	}
	return otlptracegrpc.New(context.Background(), opts...)
}

func otlpHost(endpoint string) string {
	s := strings.TrimSpace(endpoint)
	s = strings.TrimPrefix(s, "https://")
	s = strings.TrimPrefix(s, "http://")
	if i := strings.IndexByte(s, '/'); i >= 0 {
		s = s[:i]
	}
	return s
}

func debugLog(phase string, err error) {
	slog.Debug("telemetry", "phase", phase, "err", err.Error())
}

func bestEffort(fn func()) {
	defer func() { _ = recover() }()
	fn()
}
