package fookie

import (
	"context"

	"github.com/fookiejs/fookie/internal/telemetry"
)

type FlowMetric struct {
	ctx      context.Context
	model    string
	entityID string
}

func NewFlowMetric(ctx context.Context, model, entityID string) FlowMetric {
	return newFlowMetric(ctx, model, entityID)
}

func newFlowMetric(ctx context.Context, model, entityID string) FlowMetric {
	if ctx == nil {
		ctx = context.Background()
	}
	return FlowMetric{ctx: ctx, model: model, entityID: entityID}
}

func (m FlowMetric) baseAttrs(extra map[string]string) map[string]string {
	attrs := make(map[string]string, len(extra)+2)
	attrs["model"] = m.model
	if m.entityID != "" {
		attrs["entity_id"] = m.entityID
	}
	for k, v := range extra {
		attrs[k] = v
	}
	return attrs
}

func (m FlowMetric) Increment(name string, tags map[string]string) {
	full, err := m.emitName(name)
	if err != nil {
		flog.Warn("metric.rejected", "name", name, flogErr, err.Error())
		return
	}
	telemetry.EmitCounter(m.ctx, full, m.baseAttrs(tags))
}

func (m FlowMetric) Histogram(name string, value float64, tags map[string]string) {
	full, err := m.emitName(name)
	if err != nil {
		flog.Warn("metric.rejected", "name", name, flogErr, err.Error())
		return
	}
	telemetry.EmitHistogram(m.ctx, full, value, m.baseAttrs(tags))
}

func (m FlowMetric) Gauge(name string, value float64, tags map[string]string) {
	full, err := m.emitName(name)
	if err != nil {
		flog.Warn("metric.rejected", "name", name, flogErr, err.Error())
		return
	}
	telemetry.EmitGauge(m.ctx, full, value, m.baseAttrs(tags))
}

func (m FlowMetric) emitName(name string) (string, error) {
	if err := telemetry.ValidateUserMetric(name); err != nil {
		return "", err
	}
	return telemetry.NormalizeCustom(name), nil
}
