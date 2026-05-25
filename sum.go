package fookie

func Sum[F any](ctx execCtx, model *Model[F], field orderable, filter func(F)) int64 {
	if model == nil || model.stored == nil {
		return 0
	}

	tx := ctx.dbTx()
	if tx == nil {
		return 0
	}

	lockKey := "sum:" + model.stored.name
	if err := dbAdvisoryLock(tx, lockKey); err != nil {
		flog.Warn("sum.lock_error", flogModel, model.stored.name, flogErr, err.Error())
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
	excludeID := ctx.currentEntityID()

	total, err := sumTx(tx, model.stored, column, excludeID, qb.filters)
	if err != nil {
		flog.Warn("sum.query_error", flogModel, model.stored.name, flogErr, err.Error())
		return 0
	}
	return total
}
