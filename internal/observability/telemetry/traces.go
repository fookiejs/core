package telemetry

import (
	"context"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/trace"
)

func tracer() trace.Tracer {
	return otel.Tracer(meterName)
}

func emitSpan(spanName, event string, attrs map[string]string) {
	ctx := context.Background()
	san := sanitizeAttrs(attrs)
	opts := make([]trace.SpanStartOption, 0, 1)
	if len(san) > 0 {
		opts = append(opts, trace.WithAttributes(attrsToOTel(san)...))
	}
	_, span := tracer().Start(ctx, spanName, opts...)
	if event != "" {
		span.AddEvent(event)
	}
	span.End()
}

func EmitTrace(_ context.Context, spanName, event string, attrs map[string]string) {
	emitSpan(spanName, event, attrs)
}

func PropagateHeaders(ctx context.Context) map[string]string {
	carrier := mapCarrier(make(map[string]string))
	otel.GetTextMapPropagator().Inject(ctx, carrier)
	return map[string]string(carrier)
}

func ContextFromHeaders(parent context.Context, headers map[string]string) context.Context {
	if len(headers) == 0 {
		return parent
	}
	return otel.GetTextMapPropagator().Extract(parent, mapCarrier(headers))
}

type mapCarrier map[string]string

func (c mapCarrier) Get(key string) string { return c[key] }
func (c mapCarrier) Set(key, value string) { c[key] = value }
func (c mapCarrier) Keys() []string {
	keys := make([]string, 0, len(c))
	for k := range c {
		keys = append(keys, k)
	}
	return keys
}
