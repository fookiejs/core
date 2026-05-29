package model

import (
	"github.com/fookiejs/fookie/internal/persistence/store"
)

func StoreFilters(m *StoredModel, fs []ListFilter) []store.Filter {
	out := make([]store.Filter, 0, len(fs))
	for _, f := range fs {
		out = append(out, store.Filter{Field: m.ColumnForField(f.Field), Op: f.Op, Value: f.Value})
	}
	return out
}

func BuildStoreQuery(m *StoredModel, qb *Builder) store.Query {
	orders := make([]store.Order, 0, len(qb.Orders()))
	for _, o := range qb.Orders() {
		orders = append(orders, store.Order{Field: o.Field(), Desc: o.Desc()})
	}
	return store.Query{
		Filters:   StoreFilters(m, qb.Filters),
		Orders:    orders,
		Limit:     qb.Limit,
		Cursor:    qb.Cursor,
		CursorDir: int(qb.CursorDir),
	}
}
