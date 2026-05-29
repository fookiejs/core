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

func BuildStoreQuery(modelDefinition *StoredModel, queryBuilder *Builder) store.Query {
	orders := make([]store.Order, 0, len(queryBuilder.Orders()))
	for _, o := range queryBuilder.Orders() {
		orders = append(orders, store.Order{Field: o.Field(), Desc: o.Desc()})
	}
	return store.Query{
		Filters:   StoreFilters(modelDefinition, queryBuilder.Filters),
		Orders:    orders,
		Limit:     queryBuilder.Limit,
		Cursor:    queryBuilder.Cursor,
		CursorDir: int(queryBuilder.CursorDir),
	}
}
