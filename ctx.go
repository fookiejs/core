package fookie

import (
	"context"
	"strings"

	"github.com/fookiejs/fookie/internal/telemetry"
	"github.com/jackc/pgx/v5"
)

// FlowLogger is the structured logger bound to a Flow.
// Model name and entity ID are automatically included in every log line.
type FlowLogger struct {
	model    string
	entityID string
}

func newFlowLogger(model, entityID string) FlowLogger {
	return FlowLogger{model: model, entityID: entityID}
}

func (l FlowLogger) base() []any {
	b := []any{flogModel, l.model}
	if l.entityID != "" {
		b = append(b, flogEntityID, l.entityID)
	}
	return b
}

func (l FlowLogger) Info(msg string, args ...any) {
	flog.Info(msg, append(l.base(), args...)...)
}

func (l FlowLogger) Warn(msg string, args ...any) {
	flog.Warn(msg, append(l.base(), args...)...)
}

func (l FlowLogger) Debug(msg string, args ...any) {
	flog.Debug(msg, append(l.base(), args...)...)
}

func (l FlowLogger) Error(msg string, args ...any) {
	flog.Error(msg, append(l.base(), args...)...)
}

type Flow[F any] struct {
	Model    *storedModel
	Headers  map[string]string
	Body     F
	Filter   F
	Log      FlowLogger
	Metric   FlowMetric
	qb       *queryBuilder
	tx       pgx.Tx
	app      *App
	entityID    string
	execTraceID string
	execCtx     context.Context
}

func NewFlow[F any](model *storedModel, body F) *Flow[F] {
	name := ""
	if model != nil {
		name = model.name
	}
	return &Flow[F]{
		Model:   model,
		Headers: map[string]string{},
		Body:    body,
		Log:     newFlowLogger(name, ""),
		Metric:  newFlowMetric(context.Background(), name, ""),
	}
}

func NewListFlow[F any](model *storedModel) *Flow[F] {
	qb := &queryBuilder{model: model}
	var schema F
	if model.schema != nil {
		if s, ok := model.schema.(F); ok {
			schema = s
		}
	}
	return &Flow[F]{
		Model:  model,
		Filter: attachFilter(schema, qb),
		Log:    newFlowLogger(model.name, ""),
		Metric: newFlowMetric(context.Background(), model.name, ""),
		qb:     qb,
	}
}

func (c *Flow[F]) header(key string) (string, bool) {
	if c.Headers == nil {
		return "", false
	}
	if v, ok := c.Headers[key]; ok {
		return v, true
	}
	for k, v := range c.Headers {
		if strings.EqualFold(k, key) {
			return v, true
		}
	}
	return "", false
}

func (c *Flow[F]) Header(key string) (string, bool) { return c.header(key) }

func (c *Flow[F]) dbTx() pgx.Tx { return c.tx }

func (c *Flow[F]) modelName() string {
	if c.Model == nil {
		return ""
	}
	return c.Model.name
}

func (c *Flow[F]) currentEntityID() string { return c.entityID }

func (c *Flow[F]) appRef() *App { return c.app }

func (c *Flow[F]) traceID() string {
	if c.execCtx != nil {
		if id := telemetry.TraceID(c.execCtx); id != "" {
			return id
		}
	}
	return c.execTraceID
}

func (c *Flow[F]) execContext() context.Context {
	if c.execCtx != nil {
		return c.execCtx
	}
	return context.Background()
}

func (c *Flow[F]) OrderBy(field orderable) *OrderClause {
	if c.qb == nil {
		return &OrderClause{}
	}
	return &OrderClause{qb: c.qb, key: field.OrderKey()}
}

func (c *Flow[F]) Limit(n int) {
	if c.qb != nil {
		c.qb.limit = n
	}
}

func (c *Flow[F]) After(cursor string) {
	if c.qb == nil || cursor == "" {
		return
	}
	c.qb.cursor = cursor
	c.qb.cursorDir = cursorAfter
}

func (c *Flow[F]) Before(cursor string) {
	if c.qb == nil || cursor == "" {
		return
	}
	c.qb.cursor = cursor
	c.qb.cursorDir = cursorBefore
}

func (c *Flow[F]) Fail(err *FailError) {
	panic(failPanic{err: err})
}

func (c *Flow[F]) Lock(key string) error {
	if c.tx == nil {
		return nil
	}
	return dbAdvisoryLock(c.tx, key)
}

type FailError struct {
	Code        string
	Description string
}

func (e *FailError) Error() string {
	if e.Description == "" {
		return e.Code
	}
	return e.Code + ": " + e.Description
}

func NewError(code, description string) *FailError {
	return &FailError{Code: code, Description: description}
}
