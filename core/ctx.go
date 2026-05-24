package fookie

// execCtx is defined in external.go — shared by Internal.Run and External.Run.

type Ctx[F any] struct {
	Model   *storedModel
	Headers map[string]string
	Body    F
	Filter  F
	qb      *queryBuilder
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

func (c *Ctx[F]) Header(key string) string {
	return c.header(key)
}

// OrderBy takes any semantic field that implements orderable (has OrderKey()),
// and returns an *OrderClause so the caller can chain .Desc() or .Asc().
//
//	ctx.OrderBy(Account.Field.DailyLimit).Desc()
func (c *Ctx[F]) OrderBy(field orderable) *OrderClause {
	if c.qb == nil {
		return &OrderClause{}
	}
	return &OrderClause{qb: c.qb, key: field.OrderKey()}
}

// Limit sets the maximum number of rows returned by a List operation.
// UUIDv7 cursor pagination never needs OFFSET — use After/Before instead.
func (c *Ctx[F]) Limit(n int) {
	if c.qb != nil {
		c.qb.limit = n
	}
}

// After sets a forward cursor: the next page starts after this UUIDv7 id.
// Translates to WHERE id > cursor ORDER BY id ASC.
// Passing an empty string returns the first page.
func (c *Ctx[F]) After(cursor string) {
	if c.qb == nil || cursor == "" {
		return
	}
	c.qb.cursor = cursor
	c.qb.cursorDir = cursorAfter
}

// Before sets a backward cursor: the previous page ends before this UUIDv7 id.
// Translates to WHERE id < cursor ORDER BY id DESC.
// Passing an empty string is a no-op.
func (c *Ctx[F]) Before(cursor string) {
	if c.qb == nil || cursor == "" {
		return
	}
	c.qb.cursor = cursor
	c.qb.cursorDir = cursorBefore
}

// Fail returns the given *FailError as an error.
// Errors must be pre-defined typed vars — no magic strings at call sites.
//
//	var errUnauthorized = fookie.NewError("unauthorized", "Token is missing or invalid")
//	return ctx.Fail(errUnauthorized)
func (c *Ctx[F]) Fail(err *FailError) error {
	return err
}

// FailError is the structured error type returned by ctx.Fail.
// Define domain errors as package-level vars with NewError.
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

// NewError defines a typed domain error.  Call once at package level; pass to ctx.Fail.
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
