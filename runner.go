package fookie

import (
	"context"
	"fmt"
	"reflect"
)

const (
	entityStatusPending = "pending"
	entityStatusActive  = "active"
	entityStatusFailed  = "failed"
)

type modelRunner struct {
	create func(headers map[string]string, body map[string]any) (map[string]any, error)
	list   func(headers map[string]string, cursor string, limit int) ([]map[string]any, string, error)
	read   func(headers map[string]string, id string) (map[string]any, error)
	update func(headers map[string]string, id string, body map[string]any) (map[string]any, error)
	delete func(headers map[string]string, id string) error
	resume func(id string) error
}

func validateRow(fields []FieldDef, row map[string]any) *FailError {
	for _, f := range fields {
		if f.Min == nil && f.Max == nil {
			continue
		}
		n, ok := toInt64(row[f.Name])
		if !ok {
			continue
		}
		if f.Min != nil && n < *f.Min {
			return NewError("validation_error", f.Name+" below minimum")
		}
		if f.Max != nil && n > *f.Max {
			return NewError("validation_error", f.Name+" exceeds maximum")
		}
	}
	return nil
}

func toInt64(v any) (int64, bool) {
	if v == nil {
		return 0, false
	}
	rv := reflect.ValueOf(v)
	switch rv.Kind() {
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		return rv.Int(), true
	case reflect.Float32, reflect.Float64:
		return int64(rv.Float()), true
	default:
		return 0, false
	}
}

// runOp executes an op function and converts the suspend/fail panics it
// produces into normal return values. Any other panic is re-raised.
func runOp[S any](op func(*Flow[S]), ctx *Flow[S]) (suspended bool, fp *failPanic) {
	var caught any
	func() {
		defer func() { caught = recover() }()
		if op != nil {
			op(ctx)
		}
	}()
	switch p := caught.(type) {
	case nil:
		return false, nil
	case suspendPanic:
		return true, nil
	case failPanic:
		return false, &p
	default:
		panic(caught)
	}
}

func makeCreateRunner[S any](app *App, stored *storedModel, op func(*Flow[S])) func(map[string]string, map[string]any) (map[string]any, error) {
	return func(headers map[string]string, rawBody map[string]any) (map[string]any, error) {
		entityID := newUUIDv7()
		tx, err := app.db.begin(context.Background())
		if err != nil {
			return nil, err
		}
		row := make(map[string]any, len(rawBody)+3)
		for k, v := range rawBody {
			row[k] = v
		}
		row["id"] = entityID
		row["_fookie_status"] = entityStatusPending
		if _, err := insertTx(tx, stored, row); err != nil {
			_ = tx.Rollback(context.Background())
			return nil, err
		}
		if err := tx.Commit(context.Background()); err != nil {
			return nil, fmt.Errorf("tx commit: %w", err)
		}
		go runEntityOp(app, stored, op, entityID, headers, rawBody, false)
		return map[string]any{"id": entityID}, nil
	}
}

func runEntityOp[S any](app *App, stored *storedModel, op func(*Flow[S]), entityID string, headers map[string]string, rawBody map[string]any, resume bool) {
	tx, err := app.db.begin(context.Background())
	if err != nil {
		markEntityFailed(app, stored, entityID, err.Error(), traceIDForEntity(entityID))
		return
	}
	var body S
	mapToSchema(rawBody, &body)
	traceID := traceIDForEntity(entityID)
	ctx := &Flow[S]{
		Model:    stored,
		Headers:  headers,
		Body:     body,
		Log:      newFlowLogger(stored.name, entityID),
		Metric:   newFlowMetric(stored.name, entityID),
		entityID: entityID,
		execTraceID: traceID,
		tx:       tx,
		app:      app,
	}
	if resume {
		emitFlowTrace(traceID, stored.name, entityID, "flow.resumed", nil)
	} else {
		emitFlowTrace(traceID, stored.name, entityID, "flow.started", nil)
	}
	suspended, fp := runOp(op, ctx)
	if fp != nil {
		_ = autoCompensateAll(ctx)
		_ = tx.Rollback(context.Background())
		markEntityFailed(app, stored, entityID, fp.err.Error(), traceID)
		return
	}
	row := schemaToMap(ctx.Body)
	row["id"] = entityID
	if suspended {
		row["_fookie_status"] = entityStatusPending
		if _, err := updateTx(tx, stored, entityID, row); err != nil {
			_ = tx.Rollback(context.Background())
			markEntityFailed(app, stored, entityID, err.Error(), traceID)
			return
		}
		_ = tx.Commit(context.Background())
		emitFlowTrace(traceID, stored.name, entityID, "flow.suspended", nil)
		return
	}
	row["_fookie_status"] = entityStatusActive
	if verr := validateRow(stored.fields, row); verr != nil {
		_ = tx.Rollback(context.Background())
		markEntityFailed(app, stored, entityID, verr.Error(), traceID)
		return
	}
	if _, err := updateTx(tx, stored, entityID, row); err != nil {
		_ = tx.Rollback(context.Background())
		markEntityFailed(app, stored, entityID, err.Error(), traceID)
		return
	}
	_ = tx.Commit(context.Background())
	emitFlowTrace(traceID, stored.name, entityID, "flow.completed", nil)
	flog.Info("entity.created", flogModel, stored.name, flogEntityID, entityID)
}

func markEntityFailed(app *App, stored *storedModel, entityID, reason, traceID string) {
	_, _ = app.db.pool.Exec(context.Background(),
		fmt.Sprintf(`UPDATE "%s" SET "_fookie_status"='failed', "_fookie_error"=$1 WHERE "id"=$2`, stored.name),
		reason, entityID)
	emitFlowTrace(traceID, stored.name, entityID, "flow.failed", map[string]string{flogReason: reason})
	flog.Warn("entity.failed", flogModel, stored.name, flogEntityID, entityID, flogErr, reason)
}

func makeResumeRunner[S any](app *App, stored *storedModel, op func(*Flow[S])) func(string) error {
	return func(entityID string) error {
		row, err := app.db.read(stored, entityID)
		if err != nil {
			return err
		}
		go runEntityOp(app, stored, op, entityID, map[string]string{}, row, true)
		return nil
	}
}

func makeListRunner[S any](app *App, stored *storedModel, op func(*Flow[S])) func(map[string]string, string, int) ([]map[string]any, string, error) {
	return func(headers map[string]string, cursor string, limit int) ([]map[string]any, string, error) {
		ctx := NewListFlow[S](stored)
		ctx.Headers = headers
		ctx.app = app
		if op != nil {
			_, fp := runOp(op, ctx)
			if fp != nil {
				return nil, "", fp.err
			}
		}

		if ctx.qb.cursor == "" && cursor != "" {
			ctx.qb.cursor = cursor
			ctx.qb.cursorDir = cursorAfter
		}
		if ctx.qb.limit == 0 {
			if limit > 0 {
				ctx.qb.limit = limit
			} else {
				ctx.qb.limit = 50
			}
		}
		items, err := app.db.list(stored, ctx.qb)
		if err != nil {
			return nil, "", err
		}
		next := ""
		if len(items) == ctx.qb.limit {
			if last := items[len(items)-1]["id"]; last != nil {
				if s, ok := last.(string); ok {
					next = s
				}
			}
		}
		return items, next, nil
	}
}

func makeReadRunner[S any](app *App, stored *storedModel, op func(*Flow[S])) func(map[string]string, string) (map[string]any, error) {
	return func(headers map[string]string, id string) (map[string]any, error) {
		row, err := app.db.read(stored, id)
		if err != nil {
			return nil, err
		}
		if op != nil {
			var body S
			mapToSchema(row, &body)
			ctx := &Flow[S]{Model: stored, Headers: headers, Body: body, Log: newFlowLogger(stored.name, id), Metric: newFlowMetric(stored.name, id), app: app}
			_, fp := runOp(op, ctx)
			if fp != nil {
				return nil, fp.err
			}
		}
		return row, nil
	}
}

func makeUpdateRunner[S any](app *App, stored *storedModel, op func(*Flow[S])) func(map[string]string, string, map[string]any) (map[string]any, error) {
	return func(headers map[string]string, id string, rawBody map[string]any) (map[string]any, error) {
		tx, err := app.db.begin(context.Background())
		if err != nil {
			return nil, err
		}
		var body S
		mapToSchema(rawBody, &body)
		ctx := &Flow[S]{
			Model:    stored,
			Headers:  headers,
			Body:     body,
			Log:      newFlowLogger(stored.name, id),
			Metric:   newFlowMetric(stored.name, id),
			entityID: id,
			tx:       tx,
			app:      app,
		}
		suspended, fp := runOp(op, ctx)
		if fp != nil {
			_ = autoCompensateAll(ctx)
			_ = tx.Rollback(context.Background())
			return nil, fp.err
		}
		row := schemaToMap(ctx.Body)
		delete(row, "id")
		if verr := validateRow(stored.fields, row); verr != nil {
			_ = tx.Rollback(context.Background())
			return nil, verr
		}
		result, err := updateTx(tx, stored, id, row)
		if err != nil {
			_ = tx.Rollback(context.Background())
			return nil, err
		}
		if err := tx.Commit(context.Background()); err != nil {
			return nil, fmt.Errorf("tx commit: %w", err)
		}
		if suspended {
			return map[string]any{"id": id}, nil
		}
		return result, nil
	}
}

func makeDeleteRunner[S any](app *App, stored *storedModel, op func(*Flow[S])) func(map[string]string, string) error {
	return func(headers map[string]string, id string) error {
		tx, err := app.db.begin(context.Background())
		if err != nil {
			return err
		}
		ctx := &Flow[S]{Model: stored, Headers: headers, Log: newFlowLogger(stored.name, id), Metric: newFlowMetric(stored.name, id), app: app, entityID: id, tx: tx}
		_, fp := runOp(op, ctx)
		if fp != nil {
			_ = tx.Rollback(context.Background())
			return fp.err
		}
		if _, err := tx.Exec(context.Background(),
			fmt.Sprintf(`DELETE FROM "%s" WHERE "id" = $1`, stored.name), id); err != nil {
			_ = tx.Rollback(context.Background())
			return fmt.Errorf("delete %s: %w", stored.name, err)
		}
		return tx.Commit(context.Background())
	}
}
