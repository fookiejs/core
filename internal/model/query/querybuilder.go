package query

import (
	"github.com/fookiejs/fookie/internal/model/schemawire"
	"github.com/fookiejs/fookie/semantic"
	"github.com/jackc/pgx/v5"
)

type CursorDirection int

const (
	CursorNone CursorDirection = iota
	CursorAfter
	CursorBefore
)

type Builder struct {
	Model     *schemawire.StoredModel
	Filters   []schemawire.ListFilter
	orders    []OrderExpr
	Limit     int
	Cursor    string
	CursorDir CursorDirection
}

type OrderExpr struct {
	field string
	desc  bool
}

type OrderClause struct {
	QB  *Builder
	Key string
}

func (o *OrderClause) Desc() {
	o.QB.orders = append(o.QB.orders, OrderExpr{field: o.Key, desc: true})
}

func (o *OrderClause) Asc() {
	o.QB.orders = append(o.QB.orders, OrderExpr{field: o.Key, desc: false})
}

func NewBuilder(stored *schemawire.StoredModel) *Builder {
	return &Builder{Model: stored}
}

func (queryBuilder *Builder) Add(field, operation string, value semantic.FilterValue) {
	queryBuilder.Filters = append(queryBuilder.Filters, schemawire.ListFilter{Field: field, Op: operation, Value: value})
}

func (o OrderExpr) Field() string { return o.field }

func (o OrderExpr) Desc() bool { return o.desc }

func (queryBuilder *Builder) Orders() []OrderExpr { return queryBuilder.orders }

type Orderable interface {
	OrderKey() string
}

type SumContext interface {
	DBTx() pgx.Tx
	CurrentEntityID() string
}
