package fookie

import (
	"context"
	"encoding/json"
	"fmt"
	"reflect"
	"time"

	"github.com/fookiejs/fookie/internal/telemetry"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// suspendPanic is thrown by Require when an external call is still in
// progress and the operation must be suspended (entity persists in
// pending state until the outbox completes and resumes it).
type suspendPanic struct{}

// failPanic is thrown by Require when an external call has failed
// permanently or any infrastructure error occurs. Carries the error
// that should be surfaced to the caller.
type failPanic struct{ err error }

type execCtx interface {
	header(key string) string
	dbTx() pgx.Tx
	modelName() string
	currentEntityID() string
	appRef() *App
	traceID() string
}

// Require dispatches an external call and returns its output directly.
// In an entity context (Create/Update/Delete) it panics with suspendPanic
// when the call is still in progress so the runner can persist the entity
// in pending state. In a list context it blocks-polls the outbox until
// the external completes (or fails / times out).
//
// Require never returns an error — failures propagate via panic(failPanic).
func (e External[I, O]) Require(ctx execCtx, input I) O {
	entityID := ctx.currentEntityID()
	if entityID == "" {
		return e.requireList(ctx, input)
	}
	return e.requireEntity(ctx, input)
}

func (e External[I, O]) requireEntity(ctx execCtx, input I) O {
	tx := ctx.dbTx()
	if tx == nil {
		panic(failPanic{err: fmt.Errorf("no_transaction")})
	}
	inputJSON, err := marshalInput(input)
	if err != nil {
		panic(failPanic{err: fmt.Errorf("marshal_input: %w", err)})
	}
	callKey := outboxCallKey(ctx.currentEntityID(), e.Name, inputJSON)
	entry, err := outboxLookup(tx, callKey)
	if err != nil {
		panic(failPanic{err: fmt.Errorf("outbox_lookup: %w", err)})
	}
	switch {
	case entry == nil:
		if err := outboxInsert(tx, e.Name, callKey, inputJSON, e.Retry); err != nil {
			panic(failPanic{err: fmt.Errorf("outbox_insert: %w", err)})
		}
		if err := outboxAddWaiter(tx, callKey, ctx.modelName(), ctx.currentEntityID()); err != nil {
			panic(failPanic{err: fmt.Errorf("outbox_waiter: %w", err)})
		}
		tr := ctx.traceID()
		emitExternalTrace(tr, e.Name, ctx.modelName(), ctx.currentEntityID(), "external.started", map[string]string{flogCallKey: callKey})
		telemetry.EmitCounter("external.call.started", map[string]string{"service": e.Name, "model": ctx.modelName()})
		flog.Info("external.dispatch",
			flogService, e.Name,
			flogModel, ctx.modelName(),
			flogEntityID, ctx.currentEntityID(),
			flogCallKey, callKey)
		dispatchInProcess(ctx.appRef(), e.Name, callKey, inputJSON)
		emitFlowTrace(tr, ctx.modelName(), ctx.currentEntityID(), "flow.suspended", map[string]string{flogService: e.Name})
		panic(suspendPanic{})
	case entry.Status == outboxStatusCompleted:
		var out O
		if err := mapOutputJSON(entry.Output, &out); err != nil {
			panic(failPanic{err: fmt.Errorf("unmarshal_output: %w", err)})
		}
		compensateName, found, _ := lookupCompensateName(tx, ctx.appRef(), e.Name)
		if found {
			_ = sagaRecordStep(tx, ctx.currentEntityID(), ctx.modelName(), e.Name, compensateName, inputJSON, entry.Output)
			flog.Debug("saga.step_recorded",
				flogService, e.Name,
				flogCompensate, compensateName,
				flogModel, ctx.modelName(),
				flogEntityID, ctx.currentEntityID())
		}
		tr := ctx.traceID()
		emitExternalTrace(tr, e.Name, ctx.modelName(), ctx.currentEntityID(), "external.completed", map[string]string{flogCallKey: callKey})
		telemetry.EmitCounter("external.call.completed", map[string]string{"service": e.Name, "model": ctx.modelName()})
		flog.Info("external.completed",
			flogService, e.Name,
			flogModel, ctx.modelName(),
			flogEntityID, ctx.currentEntityID(),
			flogCallKey, callKey)
		return out
	case entry.Status == outboxStatusFailed:
		tr := ctx.traceID()
		emitExternalTrace(tr, e.Name, ctx.modelName(), ctx.currentEntityID(), "external.failed", map[string]string{flogCallKey: callKey, flogReason: entry.ErrorMsg})
		telemetry.EmitCounter("external.call.failed", map[string]string{"service": e.Name, "model": ctx.modelName()})
		flog.Warn("external.failed",
			flogService, e.Name,
			flogModel, ctx.modelName(),
			flogEntityID, ctx.currentEntityID(),
			flogCallKey, callKey,
			flogReason, entry.ErrorMsg)
		panic(failPanic{err: fmt.Errorf("%s", entry.ErrorMsg)})
	default:
		if err := outboxAddWaiter(tx, callKey, ctx.modelName(), ctx.currentEntityID()); err != nil {
			panic(failPanic{err: fmt.Errorf("outbox_waiter: %w", err)})
		}
		tr := ctx.traceID()
		emitExternalTrace(tr, e.Name, ctx.modelName(), ctx.currentEntityID(), "external.pending", map[string]string{flogCallKey: callKey})
		emitFlowTrace(tr, ctx.modelName(), ctx.currentEntityID(), "flow.suspended", map[string]string{flogService: e.Name})
		panic(suspendPanic{})
	}
}

func (e External[I, O]) requireList(ctx execCtx, input I) O {
	app := ctx.appRef()
	if app == nil {
		var zero O
		return zero
	}
	bgCtx := context.Background()
	pool := app.db.pool

	inputJSON, err := marshalInput(input)
	if err != nil {
		panic(failPanic{err: fmt.Errorf("marshal_input: %w", err)})
	}
	callKey := outboxCallKey("", e.Name, inputJSON)

	var status, output, errMsg string
	scanErr := pool.QueryRow(bgCtx,
		`SELECT status, COALESCE(output::text,''), COALESCE(error_msg,'') FROM fookie_outbox WHERE call_key=$1`,
		callKey).Scan(&status, &output, &errMsg)

	if scanErr != nil {
		if err := outboxInsertPool(bgCtx, pool, e.Name, callKey, inputJSON, e.Retry); err != nil {
			panic(failPanic{err: fmt.Errorf("outbox_insert: %w", err)})
		}
		flog.Info("external.dispatch", flogService, e.Name, flogCallKey, callKey)
		dispatchInProcess(app, e.Name, callKey, inputJSON)
	} else {
		switch status {
		case outboxStatusCompleted:
			var out O
			if err := mapOutputJSON([]byte(output), &out); err != nil {
				panic(failPanic{err: fmt.Errorf("unmarshal_output: %w", err)})
			}
			flog.Info("external.completed", flogService, e.Name, flogCallKey, callKey)
			return out
		case outboxStatusFailed:
			panic(failPanic{err: fmt.Errorf("%s", errMsg)})
		}
	}

	outputBytes, err := pollOutbox(bgCtx, pool, callKey, 30*time.Second)
	if err != nil {
		panic(failPanic{err: err})
	}
	var out O
	if err := mapOutputJSON(outputBytes, &out); err != nil {
		panic(failPanic{err: fmt.Errorf("unmarshal_output: %w", err)})
	}
	flog.Info("external.completed", flogService, e.Name, flogCallKey, callKey)
	return out
}

func pollOutbox(ctx context.Context, pool *pgxpool.Pool, callKey string, timeout time.Duration) ([]byte, error) {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		var status, output, errMsg string
		err := pool.QueryRow(ctx,
			`SELECT status, COALESCE(output::text,''), COALESCE(error_msg,'') FROM fookie_outbox WHERE call_key=$1`,
			callKey).Scan(&status, &output, &errMsg)
		if err == nil {
			switch status {
			case outboxStatusCompleted:
				return []byte(output), nil
			case outboxStatusFailed:
				return nil, fmt.Errorf("%s", errMsg)
			}
		}
		time.Sleep(50 * time.Millisecond)
	}
	return nil, fmt.Errorf("external timeout after %s", timeout)
}

func autoCompensateAll(ctx execCtx) error {
	tx := ctx.dbTx()
	if tx == nil {
		return nil
	}
	entityID := ctx.currentEntityID()
	model := ctx.modelName()
	if entityID == "" || model == "" {
		return nil
	}
	steps, err := sagaLoadSteps(tx, entityID, model)
	if err != nil {
		return err
	}
	if len(steps) == 0 {
		return nil
	}
	flog.Info("saga.compensate_all",
		flogModel, model,
		flogEntityID, entityID,
		flogStepCount, len(steps))
	start := time.Now()
	for _, step := range steps {
		compInput := step.compensateInput()
		callKey := outboxCallKey(entityID, step.Compensate, compInput)
		if err := outboxInsert(tx, step.Compensate, callKey, compInput, Retry{Attempts: 3}); err != nil {
			return err
		}
		if err := outboxAddWaiter(tx, callKey, model, entityID); err != nil {
			return err
		}
		flog.Debug("saga.compensation_dispatched",
			flogService, step.StepName,
			flogCompensate, step.Compensate,
			flogModel, model,
			flogEntityID, entityID)
		dispatchInProcess(ctx.appRef(), step.Compensate, callKey, compInput)
	}
	if err := sagaClearSteps(tx, entityID, model); err != nil {
		return err
	}
	flog.Info("saga.compensate_all_done",
		flogModel, model,
		flogEntityID, entityID,
		flogStepCount, len(steps),
		flogDurationMs, msElapsed(start))
	return nil
}

func dispatchInProcess(app *App, serviceName, callKey string, inputJSON []byte) {
	if app == nil {
		return
	}
	h, ok := app.externalHandlers[serviceName]
	if !ok {
		return
	}
	go func() {
		ctx := context.Background()
		output, err := h(ctx, inputJSON)
		if err != nil {
			_ = outboxFail(ctx, app.db.pool, callKey, err.Error())
			return
		}
		if err := outboxComplete(ctx, app.db.pool, callKey, output); err != nil {
			return
		}
		waiters, err := outboxWaiters(ctx, app.db.pool, callKey)
		if err != nil {
			return
		}
		for _, w := range waiters {
			app.resumeEntity(w.Model, w.EntityID)
		}
	}()
}

func wrapExternalHandler[I, O any](h func(I) (O, error)) externalHandlerFunc {
	return func(_ context.Context, inputJSON []byte) ([]byte, error) {
		var in I
		if err := json.Unmarshal(inputJSON, &in); err != nil {
			return nil, fmt.Errorf("unmarshal input: %w", err)
		}
		out, err := h(in)
		if err != nil {
			return nil, err
		}
		return json.Marshal(out)
	}
}

// wrapCompensationHandler wraps a two-argument compensation handler into the
// internal externalHandlerFunc signature. The payload is expected to be
// {"input":<forward-input>,"output":<forward-output>} as produced by
// sagaStep.compensateInput().
func wrapCompensationHandler[FI, FO, R any](h func(FI, FO) (R, error)) externalHandlerFunc {
	return func(_ context.Context, payloadJSON []byte) ([]byte, error) {
		var wrapper struct {
			Input  FI `json:"input"`
			Output FO `json:"output"`
		}
		if err := json.Unmarshal(payloadJSON, &wrapper); err != nil {
			return nil, fmt.Errorf("unmarshal compensation payload: %w", err)
		}
		result, err := h(wrapper.Input, wrapper.Output)
		if err != nil {
			return nil, err
		}
		return json.Marshal(result)
	}
}

func mapOutputJSON(data []byte, out any) error {
	if len(data) == 0 || out == nil {
		return nil
	}
	var raw map[string]any
	if err := json.Unmarshal(data, &raw); err != nil {
		return fmt.Errorf("unmarshal output: %w", err)
	}
	mapOutput(raw, out)
	return nil
}

func resolveInput(in any) map[string]any {
	if in == nil {
		return nil
	}
	rv := reflect.ValueOf(in)
	if rv.Kind() == reflect.Pointer {
		rv = rv.Elem()
	}
	if rv.Kind() != reflect.Struct {
		return nil
	}
	rt := rv.Type()
	out := make(map[string]any, rt.NumField())
	for i := range rt.NumField() {
		f := rt.Field(i)
		key := outputKey(f.Name)
		out[key] = resolveInputValue(rv.Field(i).Interface())
	}
	return out
}

func resolveInputValue(v any) any {
	rv := reflect.ValueOf(v)
	if !rv.IsValid() {
		return nil
	}
	m := rv.MethodByName("Value")
	if m.IsValid() && m.Type().NumIn() == 0 && m.Type().NumOut() == 1 {
		return m.Call(nil)[0].Interface()
	}
	return v
}

func mapOutput(raw map[string]any, out any) {
	if out == nil || raw == nil {
		return
	}
	rv := reflect.ValueOf(out)
	if rv.Kind() != reflect.Pointer || rv.IsNil() {
		return
	}
	rv = rv.Elem()
	if rv.Kind() != reflect.Struct {
		return
	}
	rt := rv.Type()
	for i := range rt.NumField() {
		key := outputKey(rt.Field(i).Name)
		v, ok := raw[key]
		if !ok {
			continue
		}
		fv := rv.Field(i)
		if !fv.CanSet() {
			continue
		}
		setter := fv.Addr().MethodByName("Set")
		if setter.IsValid() && setter.Type().NumIn() == 1 {
			val := reflect.ValueOf(v)
			want := setter.Type().In(0)
			if val.IsValid() && val.Type().ConvertibleTo(want) {
				setter.Call([]reflect.Value{val.Convert(want)})
			}
			continue
		}
		val := reflect.ValueOf(v)
		if val.IsValid() && val.Type().AssignableTo(fv.Type()) {
			fv.Set(val)
		} else if val.IsValid() && val.Type().ConvertibleTo(fv.Type()) {
			fv.Set(val.Convert(fv.Type()))
		}
	}
}

func outputKey(fieldName string) string { return toSnake(fieldName) }
