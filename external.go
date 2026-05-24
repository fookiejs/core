package fookie

import (
	"context"
	"encoding/json"
	"reflect"
	"strings"
	"unicode"

	"github.com/jackc/pgx/v5"
)

type externalStatus int

const (
	statusCompleted externalStatus = iota
	statusRunning
	statusFailed
)

type ExternalState struct {
	status externalStatus
	reason string
}

func (s ExternalState) Running() bool   { return s.status == statusRunning }
func (s ExternalState) Failed() bool    { return s.status == statusFailed }
func (s ExternalState) Completed() bool { return s.status == statusCompleted }
func (s ExternalState) Reason() string  { return s.reason }

func (s ExternalState) Error() string {
	switch s.status {
	case statusRunning:
		return "suspended: waiting for external"
	case statusFailed:
		return "external_failed: " + s.reason
	default:
		return ""
	}
}

type ExternalStep[O any] struct {
	result O
}

func (s ExternalStep[O]) Result() O { return s.result }

type execCtx interface {
	header(key string) string
	dbTx() pgx.Tx
	modelName() string
	currentEntityID() string
	appRef() *App
	isResume() bool
}

func (e External[I, O]) Run(ctx execCtx, input I) (ExternalStep[O], ExternalState) {
	tx := ctx.dbTx()
	if tx == nil {
		return ExternalStep[O]{}, ExternalState{status: statusFailed, reason: "no_transaction"}
	}

	inputJSON, err := marshalInput(input)
	if err != nil {
		return ExternalStep[O]{}, ExternalState{status: statusFailed, reason: "marshal_input: " + err.Error()}
	}

	callKey := outboxCallKey(ctx.currentEntityID(), e.Name, inputJSON)

	entry, err := outboxLookup(tx, callKey)
	if err != nil {
		return ExternalStep[O]{}, ExternalState{status: statusFailed, reason: "outbox_lookup: " + err.Error()}
	}

	switch {
	case entry == nil:
		if err := outboxInsert(tx, e.Name, callKey, inputJSON, e.Retry); err != nil {
			return ExternalStep[O]{}, ExternalState{status: statusFailed, reason: "outbox_insert: " + err.Error()}
		}
		if err := outboxAddWaiter(tx, callKey, ctx.modelName(), ctx.currentEntityID()); err != nil {
			return ExternalStep[O]{}, ExternalState{status: statusFailed, reason: "outbox_waiter: " + err.Error()}
		}
		dispatchInProcess(ctx.appRef(), e.Name, callKey, inputJSON)
		return ExternalStep[O]{}, ExternalState{status: statusRunning}

	case entry.Status == outboxStatusCompleted:
		var out O
		if err := mapOutputJSON(entry.Output, &out); err != nil {
			return ExternalStep[O]{}, ExternalState{status: statusFailed, reason: "unmarshal_output: " + err.Error()}
		}
		return ExternalStep[O]{result: out}, ExternalState{status: statusCompleted}

	case entry.Status == outboxStatusFailed:
		return ExternalStep[O]{}, ExternalState{status: statusFailed, reason: entry.ErrorMsg}

	default:
		if err := outboxAddWaiter(tx, callKey, ctx.modelName(), ctx.currentEntityID()); err != nil {
			return ExternalStep[O]{}, ExternalState{status: statusFailed, reason: "outbox_waiter: " + err.Error()}
		}
		return ExternalStep[O]{}, ExternalState{status: statusRunning}
	}
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
			_ = outboxFail(ctx, app.db.pool, callKey, err.Error(), 3)
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

func wrapExternalHandler[I, O any](h func(context.Context, I) (O, error)) externalHandlerFunc {
	return func(ctx context.Context, inputJSON []byte) ([]byte, error) {
		var in I
		if err := json.Unmarshal(inputJSON, &in); err != nil {
			return nil, err
		}
		out, err := h(ctx, in)
		if err != nil {
			return nil, err
		}
		return json.Marshal(out)
	}
}

func mapOutputJSON(data []byte, out any) error {
	if len(data) == 0 || out == nil {
		return nil
	}
	var raw map[string]any
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}
	mapOutput(raw, out)
	return nil
}

func resolveInput(in any) map[string]any {
	if in == nil {
		return nil
	}
	rv := reflect.ValueOf(in)
	if rv.Kind() == reflect.Ptr {
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
	if rv.Kind() != reflect.Ptr || rv.IsNil() {
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

func outputKey(fieldName string) string {
	if fieldName == "OK" {
		return "ok"
	}
	var b strings.Builder
	for i, r := range fieldName {
		if i > 0 && unicode.IsUpper(r) {
			b.WriteByte('_')
		}
		b.WriteRune(unicode.ToLower(r))
	}
	return b.String()
}
