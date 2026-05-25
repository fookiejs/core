package fookie

import (
	"strconv"

	"github.com/fookiejs/fookie/internal/telemetry"
)

func traceIDForEntity(entityID string) string {
	if entityID == "" {
		return "trc_" + newUUIDv7()
	}
	return "trc_" + entityID
}

func flowAttrs(model, entityID string) map[string]string {
	m := map[string]string{"model": model}
	if entityID != "" {
		m["entity_id"] = entityID
	}
	return m
}

func emitFlowTrace(traceID, model, entityID, event string, extra map[string]string) {
	attrs := flowAttrs(model, entityID)
	for k, v := range extra {
		attrs[k] = v
	}
	telemetry.EmitTrace(traceID, "flow."+model, event, attrs)
}

func emitExternalTrace(traceID, service, model, entityID, event string, extra map[string]string) {
	attrs := map[string]string{"service": service, "model": model, "entity_id": entityID}
	for k, v := range extra {
		attrs[k] = v
	}
	telemetry.EmitTrace(traceID, "external."+service, event, attrs)
}

func emitHTTPReceived(method, path, model string) {
	attrs := map[string]string{"method": method, "path": path}
	if model != "" {
		attrs["model"] = model
	}
	telemetry.EmitCounter("http.request.received", attrs)
}

func emitHTTPDuration(method, path, model string, ms float64, status int) {
	attrs := map[string]string{
		"method": method,
		"path":   path,
		"status": strconv.Itoa(status),
	}
	if model != "" {
		attrs["model"] = model
	}
	telemetry.EmitHistogram("http.request.duration", ms, attrs)
}

func emitGraphQLReceived(op string) {
	attrs := map[string]string{}
	if op != "" {
		attrs["operation"] = op
	}
	telemetry.EmitCounter("graphql.request.received", attrs)
}

func emitGraphQLDuration(op string, ms float64) {
	attrs := map[string]string{}
	if op != "" {
		attrs["operation"] = op
	}
	telemetry.EmitHistogram("graphql.request.duration", ms, attrs)
}
