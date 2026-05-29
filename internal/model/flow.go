package model

import (
	"context"
	"strings"

	"github.com/fookiejs/fookie/internal/observability"
	"github.com/fookiejs/fookie/internal/persistence/row"
	"github.com/fookiejs/fookie/internal/persistence/store"
	"github.com/jackc/pgx/v5"
)

type FlowLogger struct {
	model    string
	entityID string
}

func newFlowLogger(model, entityID string) FlowLogger {
	return FlowLogger{model: model, entityID: entityID}
}

func (l FlowLogger) base() []any {
	b := []any{observability.ModelKey, l.model}
	if l.entityID != "" {
		b = append(b, observability.EntityIDKey, l.entityID)
	}
	return b
}

func (l FlowLogger) Info(message string, args ...any) {
	observability.Info(message, append(l.base(), args...)...)
}

func (l FlowLogger) Warn(message string, args ...any) {
	observability.Warn(message, append(l.base(), args...)...)
}

func (l FlowLogger) Debug(message string, args ...any) {
	observability.Debug(message, append(l.base(), args...)...)
}

func (l FlowLogger) Error(message string, args ...any) {
	observability.Error(message, append(l.base(), args...)...)
}

var (
	_ SumContext = (*Flow[struct{}])(nil)
)

type Flow[F any] struct {
	Model   *StoredModel
	Headers map[string]string
	Body    F
	Log     FlowLogger
	Metric  observability.FlowMetric

	transaction          pgx.Tx
	operationTransaction *OpTx
	ownsTx               bool
	app                  AppRef
	entityID             string
	execTraceID          string
	execCtx              context.Context
	failErr              *FailError
}

type ListFlow[F any] struct {
	Model   *StoredModel
	Headers map[string]string
	Filter  F
	Log     FlowLogger
	Metric  observability.FlowMetric

	queryBuilder *Builder
	app          AppRef
	execCtx      context.Context
	failErr      *FailError
}

func storedName(m *StoredModel) string {
	return m.Name
}

func NewListFlow[F any](ctx context.Context, model *StoredModel, fields F) *ListFlow[F] {
	queryBuilder := NewBuilder(model)
	return &ListFlow[F]{
		Model:        model,
		Headers:      map[string]string{},
		Filter:       AttachFilter(model, fields, queryBuilder),
		Log:          newFlowLogger(model.Name, ""),
		Metric:       observability.NewFlowMetric(ctx, model.Name, ""),
		queryBuilder: queryBuilder,
		execCtx:      ctx,
	}
}

func NewBoundFlow[F any](execCtx context.Context, app AppRef, model *StoredModel, entityID string, headers map[string]string, body F, operationTransaction *OpTx) *Flow[F] {
	return &Flow[F]{
		Model:                model,
		Headers:              headers,
		Body:                 body,
		Log:                  newFlowLogger(model.Name, entityID),
		Metric:               observability.NewFlowMetric(execCtx, model.Name, entityID),
		entityID:             entityID,
		execCtx:              execCtx,
		transaction:          operationTransaction.Tx,
		operationTransaction: operationTransaction,
		app:                  app,
	}
}

func NewRootFlow[F any](operationTransaction *OpTx, model *StoredModel, entityID string, headers map[string]string, body F) *Flow[F] {
	f := NewBoundFlow(operationTransaction.Ctx, operationTransaction.App, model, entityID, headers, body, operationTransaction)
	f.ownsTx = true
	return f
}

func lookupHeader(headers map[string]string, key string) (string, bool) {
	if v, ok := headers[key]; ok {
		return v, true
	}
	for k, v := range headers {
		if strings.EqualFold(k, key) {
			return v, true
		}
	}
	return "", false
}

func (c *Flow[F]) GetModel() *Model[F] { return c.Model.def.(*Model[F]) }

func (c *Flow[F]) Fields() F { return c.GetModel().Field }

func (c *ListFlow[F]) GetModel() *Model[F] { return c.Model.def.(*Model[F]) }

func (c *ListFlow[F]) Fields() F { return c.GetModel().Field }

func (c *Flow[F]) header(key string) (string, bool) { return lookupHeader(c.Headers, key) }

func (c *Flow[F]) Header(key string) (string, bool) { return c.header(key) }

func (c *Flow[F]) DBTx() pgx.Tx { return c.transaction }

func (c *Flow[F]) modelName() string { return storedName(c.Model) }

func (c *Flow[F]) CurrentEntityID() string { return c.entityID }

func (c *Flow[F]) ModelName() string { return c.modelName() }

func (c *Flow[F]) appRef() AppRef { return c.app }

func (c *Flow[F]) AppRef() AppRef { return c.appRef() }

func (c *Flow[F]) traceID() string {
	if id := observability.TraceID(c.execCtx); id != "" {
		return id
	}
	return c.execTraceID
}

func (c *Flow[F]) execContext() context.Context { return c.execCtx }

func (c *Flow[F]) ExecContext() context.Context { return c.execContext() }

func (c *Flow[F]) TraceID() string { return c.traceID() }

func (c *Flow[F]) Fail(err *FailError) Signal {
	c.failErr = err
	return Failed
}

func (c *Flow[F]) setExternalError(message string) { c.failErr = NewError("external_failed", message) }

func (c *Flow[F]) Lock(key string) error {
	return store.AdvisoryLock(c.transaction, key)
}

func (c *ListFlow[F]) header(key string) (string, bool) { return lookupHeader(c.Headers, key) }

func (c *ListFlow[F]) Header(key string) (string, bool) { return c.header(key) }

func (c *ListFlow[F]) CurrentEntityID() string { return "" }

func (c *ListFlow[F]) modelName() string { return storedName(c.Model) }

func (c *ListFlow[F]) ModelName() string { return c.modelName() }

func (c *ListFlow[F]) appRef() AppRef { return c.app }

func (c *ListFlow[F]) AppRef() AppRef { return c.appRef() }

func (c *ListFlow[F]) DBTx() pgx.Tx { return nil }

func (c *ListFlow[F]) traceID() string { return observability.TraceID(c.execCtx) }

func (c *ListFlow[F]) execContext() context.Context { return c.execCtx }

func (c *ListFlow[F]) ExecContext() context.Context { return c.execContext() }

func (c *ListFlow[F]) TraceID() string { return c.traceID() }

func (c *ListFlow[F]) OrderBy(field Orderable) *OrderClause {
	return &OrderClause{QB: c.queryBuilder, Key: field.OrderKey()}
}

func (c *ListFlow[F]) After(cursor string) {
	if cursor == "" {
		return
	}
	c.queryBuilder.Cursor = cursor
	c.queryBuilder.CursorDir = CursorAfter
}

func (c *ListFlow[F]) Before(cursor string) {
	if cursor == "" {
		return
	}
	c.queryBuilder.Cursor = cursor
	c.queryBuilder.CursorDir = CursorBefore
}

func (c *ListFlow[F]) Fail(err *FailError) Signal {
	c.failErr = err
	return Failed
}

func (c *ListFlow[F]) setExternalError(message string) {
	c.failErr = NewError("external_failed", message)
}

func NewEntityOpFlow[F any](execCtx context.Context, app AppRef, model *StoredModel, entityID string, headers map[string]string, body F, operationTransaction *OpTx, traceID string) *Flow[F] {
	f := NewBoundFlow(execCtx, app, model, entityID, headers, body, operationTransaction)
	f.execTraceID = traceID
	return f
}

func (c *ListFlow[F]) SetApp(app AppRef) { c.app = app }

func (c *ListFlow[F]) ApplyExtraFilters(extra []ListFilter) {
	for _, f := range extra {
		c.queryBuilder.Add(f.Field, f.Op, f.Value)
	}
}

func (c *ListFlow[F]) ApplyPagination(cursor string, limit int) {
	if c.queryBuilder.Cursor == "" && cursor != "" {
		c.After(cursor)
	}
	c.queryBuilder.Limit = limit
}

func (c *ListFlow[F]) ListItems(app AppRef) ([]row.Map, string, error) {
	items, err := app.DB().List(TableFor(c.Model), BuildStoreQuery(c.Model, c.queryBuilder))
	if err != nil {
		return nil, "", err
	}
	items, next := paginateList(items, c.queryBuilder.Limit)
	return items, next, nil
}

func (c *ListFlow[F]) ListItemsTx(operationTransaction *OpTx) ([]row.Map, string, error) {
	items, err := store.ListTx(operationTransaction.Ctx, operationTransaction.Tx, TableFor(c.Model), BuildStoreQuery(c.Model, c.queryBuilder))
	if err != nil {
		return nil, "", err
	}
	items, next := paginateList(items, c.queryBuilder.Limit)
	return items, next, nil
}

func paginateList(items []row.Map, limit int) ([]row.Map, string) {
	next := ""
	if limit > 0 && len(items) == limit {
		if idCell, ok := items[len(items)-1]["id"]; ok && idCell.Kind == row.KindText {
			next = idCell.Text
		}
	}
	return items, next
}

func recoverSignal(run func() Signal, fallbackErr **FailError) (signal Signal) {
	var caught any
	func() {
		defer func() { caught = recover() }()
		signal = run()
	}()
	if caught == nil {
		return signal
	}
	if p, ok := caught.(FailPanic); ok {
		if fe, ok := p.Err.(*FailError); ok {
			*fallbackErr = fe
		} else {
			*fallbackErr = NewError("internal", p.Err.Error())
		}
		return Failed
	}
	panic(caught)
}

func failureError(panicked, stashed *FailError) *FailError {
	if panicked != nil {
		return panicked
	}
	if stashed != nil {
		return stashed
	}
	return NewError("failed", "operation failed")
}

func RunOp[S any](operation func(*Flow[S]) Signal, ctx *Flow[S]) (Signal, *FailError) {
	var panicked *FailError
	signal := recoverSignal(func() Signal { return operation(ctx) }, &panicked)
	if signal != Failed {
		return signal, nil
	}
	return Failed, failureError(panicked, ctx.failErr)
}

func RunListOp[S any](operation func(*ListFlow[S]) Signal, ctx *ListFlow[S]) (Signal, *FailError) {
	var panicked *FailError
	signal := recoverSignal(func() Signal { return operation(ctx) }, &panicked)
	if signal != Failed {
		return signal, nil
	}
	return Failed, failureError(panicked, ctx.failErr)
}

func (c *Flow[F]) CompensateAll() error {
	return compensateAll(c.transaction, storedName(c.Model), c.entityID)
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
