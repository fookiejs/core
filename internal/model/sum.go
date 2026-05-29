package model

import (
	"github.com/fookiejs/fookie/internal/observability"
	"github.com/fookiejs/fookie/internal/persistence/store"
)

func (m *Model[S]) Sum(flow SumContext, field Orderable, filter func(S)) int64 {
	return sumOn(m.stored, flow, m.Field, field, filter)
}

func sumOn[S any](stored *StoredModel, flow SumContext, schema S, field Orderable, filter func(S)) int64 {
	tx := flow.DBTx()
	if err := store.AdvisoryLock(tx, "sum:"+stored.Name); err != nil {
		observability.Warn("sum.lock_error", observability.ModelKey, stored.Name, observability.ErrKey, err.Error())
	}

	qb := NewBuilder(stored)
	q := AttachFilter(stored, schema, qb)
	filter(q)

	total, err := store.SumTx(tx, TableFor(stored), field.OrderKey(), flow.CurrentEntityID(), StoreFilters(stored, qb.Filters))
	if err != nil {
		observability.Warn("sum.query_error", observability.ModelKey, stored.Name, observability.ErrKey, err.Error())
		return 0
	}
	return total
}
