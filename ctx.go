package fookie

import "github.com/jackc/pgx/v5"

type Ctx[F any] struct {
	Model    *storedModel
	Headers  map[string]string
	Body     F
	Filter   F
	qb       *queryBuilder
	tx       pgx.Tx
	app      *App
	entityID string
	resume   bool
}

func NewCtx[F any](model *storedModel, body F) *Ctx[F] {
	return &Ctx[F]{
		Model:   model,
		Headers: map[string]string{},
		Body:    body,
	}
}

func NewListCtx[F any](model *storedModel) *Ctx[F] {
	qb := &queryBuilder{model: model}
	var schema F
	if model.schema != nil {
		if s, ok := model.schema.(F); ok {
			schema = s
		}
	}
	return &Ctx[F]{
		Model:  model,
		Filter: attachFilter(schema, qb),
		qb:     qb,
	}
}

func (c *Ctx[F]) header(key string) string {
	if c.Headers == nil {
		return ""
	}
	return c.Headers[key]
}

func (c *Ctx[F]) Header(key string) string { return c.header(key) }

func (c *Ctx[F]) dbTx() pgx.Tx { return c.tx }

func (c *Ctx[F]) modelName() string {
	if c.Model == nil {
		return ""
	}
	return c.Model.name
}

func (c *Ctx[F]) currentEntityID() string { return c.entityID }

func (c *Ctx[F]) appRef() *App { return c.app }

func (c *Ctx[F]) isResume() bool { return c.resume }

func (c *Ctx[F]) OrderBy(field orderable) *OrderClause {
	if c.qb == nil {
		return &OrderClause{}
	}
	return &OrderClause{qb: c.qb, key: field.OrderKey()}
}

func (c *Ctx[F]) Limit(n int) {
	if c.qb != nil {
		c.qb.limit = n
	}
}

func (c *Ctx[F]) After(cursor string) {
	if c.qb == nil || cursor == "" {
		return
	}
	c.qb.cursor = cursor
	c.qb.cursorDir = cursorAfter
}

func (c *Ctx[F]) Before(cursor string) {
	if c.qb == nil || cursor == "" {
		return
	}
	c.qb.cursor = cursor
	c.qb.cursorDir = cursorBefore
}

func (c *Ctx[F]) Fail(err *FailError) error { return err }

func (c *Ctx[F]) Lock(key string) error {
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

func ReadModel[G any](model *Model[G], fn func(*Ctx[G])) map[string]any {
	stored := model.stored
	qb := &queryBuilder{model: stored}
	var schema G
	if stored.schema != nil {
		if s, ok := stored.schema.(G); ok {
			schema = s
		}
	}
	child := &Ctx[G]{
		Model:  stored,
		Filter: attachFilter(schema, qb),
		qb:     qb,
	}
	fn(child)
	return map[string]any{}
}
