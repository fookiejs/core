package fookie

// Sum aggregates values of a single column across all rows that match filter.
// field must be a semantic type from Model.Field that implements orderable
// (i.e. has OrderKey() — populated at Register time via attachFieldKeys).
//
//	incoming := fookie.Sum(ctx, &Transaction, Transaction.Field.Amount,
//	    func(q TransactionFields) { q.ToAccountID.Eq(fromID) })
func Sum[F any](ctx execCtx, model *Model[F], field orderable, filter func(F)) int64 {
	if model == nil || model.stored == nil {
		return 0
	}
	var schema F
	if model.stored.schema != nil {
		if s, ok := model.stored.schema.(F); ok {
			schema = s
		}
	}
	qb := &queryBuilder{model: model.stored}
	q := attachFilter(schema, qb)
	if filter != nil {
		filter(q)
	}
	column := field.OrderKey()
	// TODO: execute SELECT SUM(<column>) FROM <model> WHERE <qb.filters>
	_ = column
	return 0
}
