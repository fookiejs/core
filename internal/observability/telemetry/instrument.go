package telemetry

import (
	"context"

	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

func TraceID(ctx context.Context) string {
	sc := trace.SpanFromContext(ctx).SpanContext()
	if !sc.IsValid() {
		return ""
	}
	return sc.TraceID().String()
}

func SpanID(ctx context.Context) string {
	sc := trace.SpanFromContext(ctx).SpanContext()
	if !sc.IsValid() {
		return ""
	}
	return sc.SpanID().String()
}

func FlowStarted(ctx context.Context, model, entityID string) context.Context {
	attrs := map[string]string{attrModel: model}
	if entityID != "" {
		attrs[attrEntityID] = entityID
	}
	addCounter(ctx, flowStarted, attrs)
	return startChildSpan(ctx, "flow.execute", attrs)
}

func FlowCompleted(ctx context.Context, model, entityID string) {
	attrs := map[string]string{attrModel: model}
	if entityID != "" {
		attrs[attrEntityID] = entityID
	}
	addCounter(ctx, flowCompleted, attrs)
	endSpan(trace.SpanFromContext(ctx), nil)
}

func FlowFailed(ctx context.Context, model, entityID, reason string) {
	attrs := map[string]string{attrModel: model, "reason": reason}
	if entityID != "" {
		attrs[attrEntityID] = entityID
	}
	addCounter(ctx, flowFailed, attrs)
	span := trace.SpanFromContext(ctx)
	if span.IsRecording() && reason != "" {
		span.SetStatus(codes.Error, reason)
	}
	endSpan(span, nil)
}

func FlowSuspended(ctx context.Context, model, entityID string, extra map[string]string) {
	attrs := mergeAttrs(map[string]string{attrModel: model, attrEntityID: entityID}, extra)
	emitSpan("flow.execute", "flow.suspended", attrs)
}

func FlowResumed(ctx context.Context, model, entityID string) context.Context {
	attrs := map[string]string{attrModel: model}
	if entityID != "" {
		attrs[attrEntityID] = entityID
	}
	addCounter(ctx, flowStarted, attrs)
	return startChildSpan(ctx, "flow.execute", attrs)
}

func ExternalStarted(ctx context.Context, service, model, entityID string, extra map[string]string) context.Context {
	attrs := mergeAttrs(map[string]string{attrService: service, attrModel: model, attrEntityID: entityID}, extra)
	addCounter(ctx, externalStarted, attrs)
	return startChildSpan(ctx, "external."+service, attrs)
}

func ExternalCompleted(ctx context.Context, service, model, entityID string, extra map[string]string) {
	attrs := mergeAttrs(map[string]string{attrService: service, attrModel: model, attrEntityID: entityID}, extra)
	addCounter(ctx, externalCompleted, attrs)
	emitSpan("external."+service, "external.completed", attrs)
}

func ExternalFailed(ctx context.Context, service, model, entityID string, extra map[string]string) {
	attrs := mergeAttrs(map[string]string{attrService: service, attrModel: model, attrEntityID: entityID}, extra)
	addCounter(ctx, externalFailed, attrs)
	emitSpan("external."+service, "external.failed", attrs)
}

func ExternalPending(ctx context.Context, service, model, entityID string, extra map[string]string) {
	attrs := mergeAttrs(map[string]string{attrService: service, attrModel: model, attrEntityID: entityID}, extra)
	emitSpan("external."+service, "external.pending", attrs)
}

func ExternalRetry(ctx context.Context, service string, extra ...map[string]string) {
	var attrs map[string]string
	if len(extra) > 0 {
		attrs = extra[0]
	}
	merged := mergeAttrs(map[string]string{attrService: service}, attrs)
	addCounter(ctx, externalRetry, merged)
	addCounter(ctx, schedulerRetry, merged)
	emitSpan("external."+service, "external.retrying", merged)
}

func SchedulerRetry(ctx context.Context, service string, extra ...map[string]string) {
	var attrs map[string]string
	if len(extra) > 0 {
		attrs = extra[0]
	}
	merged := mergeAttrs(map[string]string{attrService: service}, attrs)
	addCounter(ctx, schedulerRetry, merged)
	emitSpan("scheduler.retry", "scheduler.retry", merged)
}

func SchedulerResume(ctx context.Context, model, entityID string) context.Context {
	attrs := map[string]string{attrModel: model}
	if entityID != "" {
		attrs[attrEntityID] = entityID
	}
	return startChildSpan(ctx, "scheduler.resume", attrs)
}

func startChildSpan(ctx context.Context, name string, attrs map[string]string) context.Context {
	if ctx == nil {
		ctx = context.Background()
	}
	san := sanitizeAttrs(attrs)
	opts := make([]trace.SpanStartOption, 0, 1)
	if len(san) > 0 {
		opts = append(opts, trace.WithAttributes(attrsToOTel(san)...))
	}
	ctx, _ = tracer().Start(ctx, name, opts...)
	return ctx
}

func endSpan(span trace.Span, err error) {
	if span == nil {
		return
	}
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
	}
	span.End()
}
