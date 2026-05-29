package observability

import (
	"context"
	"fmt"

	"github.com/fookiejs/fookie/internal/observability/telemetry"
)

type FlowMetric struct {
	ctx      context.Context
	model    string
	entityID string
}

func NewFlowMetric(ctx context.Context, model, entityID string) FlowMetric {
	return FlowMetric{ctx: ctx, model: model, entityID: entityID}
}

func (m FlowMetric) baseAttrs(tags []string) map[string]string {
	attrs := make(map[string]string, len(tags)/2+2)
	attrs["model"] = m.model
	if m.entityID != "" {
		attrs["entity_id"] = m.entityID
	}
	for i := 0; i+1 < len(tags); i += 2 {
		attrs[tags[i]] = tags[i+1]
	}
	return attrs
}

func (m FlowMetric) Increment(name string, tags ...string) {
	full, err := m.emitName(name)
	if err != nil {
		Warn("metric.rejected", "name", name, ErrKey, err.Error())
		return
	}
	EmitCounter(m.ctx, full, m.baseAttrs(tags))
}

func (m FlowMetric) Histogram(name string, value float64, tags ...string) {
	full, err := m.emitName(name)
	if err != nil {
		Warn("metric.rejected", "name", name, ErrKey, err.Error())
		return
	}
	EmitHistogram(m.ctx, full, value, m.baseAttrs(tags))
}

func (m FlowMetric) Gauge(name string, value float64, tags ...string) {
	full, err := m.emitName(name)
	if err != nil {
		Warn("metric.rejected", "name", name, ErrKey, err.Error())
		return
	}
	EmitGauge(m.ctx, full, value, m.baseAttrs(tags))
}

func (m FlowMetric) emitName(name string) (string, error) {
	if err := ValidateUserMetric(name); err != nil {
		return "", fmt.Errorf("metric name: %w", err)
	}
	return NormalizeCustom(name), nil
}

func TraceIDForEntity(entityID string, newUUID func() string) string {
	if entityID == "" {
		return "trc_" + newUUID()
	}
	return "trc_" + entityID
}

func EmitGraphQLDuration(ctx context.Context, operation string, ms float64, failed bool) {
	GraphQLDuration(ctx, operation, ms)
	if failed {
		GraphQLFailed(ctx, operation)
	}
}

var _ = telemetry.TraceID
