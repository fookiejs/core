package flowext

import (
	"fmt"

	"github.com/fookiejs/fookie/internal/model/query"
	"github.com/fookiejs/fookie/internal/model/schemawire"
	"github.com/fookiejs/fookie/internal/persistence/store"
)

func (m *Model[S]) Sum(flow query.SumContext, field query.Orderable, filter func(S)) int64 {
	return sumOn(m.stored, flow, m.Field, field, filter)
}

func sumOn[S any](stored *schemawire.StoredModel, flow query.SumContext, schema S, field query.Orderable, filter func(S)) int64 {
	queryBuilder := query.NewBuilder(stored)
	q := query.AttachFilter(stored, schema, queryBuilder)
	filter(q)

	total, err := store.SumTx(flow.DBTx(), schemawire.TableFor(stored), field.OrderKey(), flow.CurrentEntityID(), query.StoreFilters(stored, queryBuilder.Filters))
	if err != nil {
		fail(fmt.Errorf("sum %s: %w", stored.Name, err))
	}
	return total
}
