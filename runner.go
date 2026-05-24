package fookie

import (
	"context"
	"errors"
)

type modelRunner struct {
	create func(headers map[string]string, body map[string]any) (map[string]any, error)
	list   func(headers map[string]string, cursor string, limit int) ([]map[string]any, string, error)
	read   func(headers map[string]string, id string) (map[string]any, error)
	update func(headers map[string]string, id string, body map[string]any) (map[string]any, error)
	delete func(headers map[string]string, id string) error
	resume func(id string) error
}

func makeCreateRunner[S any](app *App, stored *storedModel, op func(*Ctx[S]) error) func(map[string]string, map[string]any) (map[string]any, error) {
	return func(headers map[string]string, rawBody map[string]any) (map[string]any, error) {
		return runCreate(app, stored, op, headers, rawBody, false)
	}
}

func makeResumeRunner[S any](app *App, stored *storedModel, op func(*Ctx[S]) error) func(string) error {
	return func(entityID string) error {
		row, err := app.db.read(stored, entityID)
		if err != nil {
			return err
		}
		_, err = runCreate(app, stored, op, map[string]string{}, row, true)
		return err
	}
}

func runCreate[S any](app *App, stored *storedModel, op func(*Ctx[S]) error, headers map[string]string, rawBody map[string]any, resume bool) (map[string]any, error) {
	entityID, _ := rawBody["id"].(string)
	if entityID == "" {
		entityID = newUUIDv7()
	}

	tx, err := app.db.begin(context.Background())
	if err != nil {
		return nil, err
	}

	var body S
	mapToSchema(rawBody, &body)
	ctx := &Ctx[S]{
		Model:    stored,
		Headers:  headers,
		Body:     body,
		entityID: entityID,
		tx:       tx,
		app:      app,
		resume:   resume,
	}

	if op != nil {
		if err := op(ctx); err != nil {
			var es ExternalState
			if errors.As(err, &es) && es.Running() {
				row := schemaToMap(ctx.Body)
				row["id"] = entityID
				var dbErr error
				if resume {
					_, dbErr = updateTx(tx, stored, entityID, row)
				} else {
					_, dbErr = insertTx(tx, stored, row)
				}
				if dbErr != nil {
					_ = tx.Rollback(context.Background())
					return nil, dbErr
				}
				if commitErr := tx.Commit(context.Background()); commitErr != nil {
					return nil, commitErr
				}
				row["id"] = entityID
				return row, nil
			}
			_ = tx.Rollback(context.Background())
			return nil, err
		}
	}

	row := schemaToMap(ctx.Body)
	row["id"] = entityID

	var result map[string]any
	if resume {
		result, err = updateTx(tx, stored, entityID, row)
	} else {
		result, err = insertTx(tx, stored, row)
	}
	if err != nil {
		_ = tx.Rollback(context.Background())
		return nil, err
	}
	if err := tx.Commit(context.Background()); err != nil {
		return nil, err
	}
	return result, nil
}

func makeListRunner[S any](app *App, stored *storedModel, op func(*Ctx[S]) error) func(map[string]string, string, int) ([]map[string]any, string, error) {
	return func(headers map[string]string, cursor string, limit int) ([]map[string]any, string, error) {
		ctx := NewListCtx[S](stored)
		ctx.Headers = headers
		ctx.app = app
		if op != nil {
			if err := op(ctx); err != nil {
				return nil, "", err
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

func makeReadRunner[S any](app *App, stored *storedModel, op func(*Ctx[S]) error) func(map[string]string, string) (map[string]any, error) {
	return func(headers map[string]string, id string) (map[string]any, error) {
		row, err := app.db.read(stored, id)
		if err != nil {
			return nil, err
		}
		if op != nil {
			var body S
			mapToSchema(row, &body)
			ctx := &Ctx[S]{Model: stored, Headers: headers, Body: body, app: app}
			if err := op(ctx); err != nil {
				return nil, err
			}
		}
		return row, nil
	}
}

func makeUpdateRunner[S any](app *App, stored *storedModel, op func(*Ctx[S]) error) func(map[string]string, string, map[string]any) (map[string]any, error) {
	return func(headers map[string]string, id string, rawBody map[string]any) (map[string]any, error) {
		tx, err := app.db.begin(context.Background())
		if err != nil {
			return nil, err
		}
		var body S
		mapToSchema(rawBody, &body)
		ctx := &Ctx[S]{
			Model:    stored,
			Headers:  headers,
			Body:     body,
			entityID: id,
			tx:       tx,
			app:      app,
		}
		if op != nil {
			if err := op(ctx); err != nil {
				_ = tx.Rollback(context.Background())
				return nil, err
			}
		}
		row := schemaToMap(ctx.Body)
		delete(row, "id")
		result, err := updateTx(tx, stored, id, row)
		if err != nil {
			_ = tx.Rollback(context.Background())
			return nil, err
		}
		if err := tx.Commit(context.Background()); err != nil {
			return nil, err
		}
		return result, nil
	}
}

func makeDeleteRunner[S any](app *App, stored *storedModel, op func(*Ctx[S]) error) func(map[string]string, string) error {
	return func(headers map[string]string, id string) error {
		ctx := &Ctx[S]{Model: stored, Headers: headers, app: app}
		if op != nil {
			if err := op(ctx); err != nil {
				return err
			}
		}
		return app.db.delete(stored, id)
	}
}
