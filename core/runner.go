package fookie

// modelRunner holds type-erased closures for each CRUD operation.
// Created at Register[S] time — each closure captures the concrete type S.
// At call time the App is passed in so runners can reach db + telemetry.
type modelRunner struct {
	create func(app *App, headers map[string]string, body map[string]any) (map[string]any, error)
	list   func(app *App, headers map[string]string, cursor string, limit int) ([]map[string]any, string, error)
	read   func(app *App, headers map[string]string, id string) (map[string]any, error)
	update func(app *App, headers map[string]string, id string, body map[string]any) (map[string]any, error)
	delete func(app *App, headers map[string]string, id string) error
}

func makeCreateRunner[S any](stored *storedModel, op func(*Ctx[S]) error) func(*App, map[string]string, map[string]any) (map[string]any, error) {
	return func(app *App, headers map[string]string, rawBody map[string]any) (map[string]any, error) {
		var body S
		mapToSchema(rawBody, &body)
		ctx := &Ctx[S]{Model: stored, Headers: headers, Body: body}
		if op != nil {
			if err := op(ctx); err != nil {
				return nil, err
			}
		}
		row := schemaToMap(ctx.Body)
		row["id"] = newUUIDv7()
		return app.db.insert(stored, row)
	}
}

// list runner returns (items, nextCursor, error).
// nextCursor is the last item's id if len(items)==limit, else "".
func makeListRunner[S any](stored *storedModel, op func(*Ctx[S]) error) func(*App, map[string]string, string, int) ([]map[string]any, string, error) {
	return func(app *App, headers map[string]string, cursor string, limit int) ([]map[string]any, string, error) {
		ctx := NewListCtx[S](stored)
		ctx.Headers = headers
		if op != nil {
			if err := op(ctx); err != nil {
				return nil, "", err
			}
		}
		// HTTP layer cursor/limit take precedence only if op didn't set them.
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

func makeReadRunner[S any](stored *storedModel, op func(*Ctx[S]) error) func(*App, map[string]string, string) (map[string]any, error) {
	return func(app *App, headers map[string]string, id string) (map[string]any, error) {
		row, err := app.db.read(stored, id)
		if err != nil {
			return nil, err
		}
		if op != nil {
			var body S
			mapToSchema(row, &body)
			ctx := &Ctx[S]{Model: stored, Headers: headers, Body: body}
			if err := op(ctx); err != nil {
				return nil, err
			}
		}
		return row, nil
	}
}

func makeUpdateRunner[S any](stored *storedModel, op func(*Ctx[S]) error) func(*App, map[string]string, string, map[string]any) (map[string]any, error) {
	return func(app *App, headers map[string]string, id string, rawBody map[string]any) (map[string]any, error) {
		var body S
		mapToSchema(rawBody, &body)
		ctx := &Ctx[S]{Model: stored, Headers: headers, Body: body}
		if op != nil {
			if err := op(ctx); err != nil {
				return nil, err
			}
		}
		row := schemaToMap(ctx.Body)
		delete(row, "id") // never overwrite primary key
		return app.db.update(stored, id, row)
	}
}

func makeDeleteRunner[S any](stored *storedModel, op func(*Ctx[S]) error) func(*App, map[string]string, string) error {
	return func(app *App, headers map[string]string, id string) error {
		ctx := &Ctx[S]{Model: stored, Headers: headers}
		if op != nil {
			if err := op(ctx); err != nil {
				return err
			}
		}
		return app.db.delete(stored, id)
	}
}
