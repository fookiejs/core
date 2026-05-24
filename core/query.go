package fookie

// cursorDirection — UUIDv7 cursor pagination yönü.
type cursorDirection int

const (
	cursorNone   cursorDirection = iota
	cursorAfter                  // WHERE id > cursor  (next page)
	cursorBefore                 // WHERE id < cursor  (prev page)
)

type queryBuilder struct {
	model     *storedModel
	filters   []queryFilter
	orders    []OrderExpr
	limit     int
	cursor    string
	cursorDir cursorDirection
}

type queryFilter struct {
	field string
	op    string // "=", ">=", "<=", "LIKE"
	value any
}

func (qb *queryBuilder) add(field, op string, value any) {
	qb.filters = append(qb.filters, queryFilter{field: field, op: op, value: value})
}

