package runtime

import (
	"github.com/fookiejs/fookie/internal/model"
	"github.com/fookiejs/fookie/internal/persistence/row"
	"github.com/fookiejs/fookie/internal/persistence/serde"
)

func NestedCreate[T any](c model.Composer, target *model.Model[T], input any) (model.ID, model.Signal) {
	bodyRow := inputToRowMap(input)
	operationTransaction, headers := c.OpTx(), c.OpHeaders()
	var identifier model.ID
	signal := c.Savepoint(func() (model.Signal, *model.FailError) {
		signal, s, failError, opErr := createTx[T](target.StoredModel(), target.Operations.Create, operationTransaction, headers, bodyRow)
		if opErr != nil {
			panic(model.FailPanic{Err: opErr})
		}
		if s == model.Failed {
			return model.Failed, failError
		}
		identifier = signal.ID
		return s, nil
	})
	return identifier, signal
}

func NestedRead[T any](c model.Composer, target *model.Model[T], id model.ID) (model.Entity[T], model.Signal) {
	operationTransaction, headers := c.OpTx(), c.OpHeaders()
	var ent model.Entity[T]
	signal := c.Savepoint(func() (model.Signal, *model.FailError) {
		signal, s, failError, opErr := readTx[T](target.StoredModel(), target.Operations.Read, operationTransaction, headers, id)
		if opErr != nil {
			panic(model.FailPanic{Err: opErr})
		}
		if s == model.Failed {
			return model.Failed, failError
		}
		ent = entityFromRecord[T](signal)
		return s, nil
	})
	return ent, signal
}

func NestedUpdate[T any](c model.Composer, target *model.Model[T], id model.ID, patch any) model.Signal {
	patchRow := patchToRowMap(patch)
	operationTransaction, headers := c.OpTx(), c.OpHeaders()
	return c.Savepoint(func() (model.Signal, *model.FailError) {
		_, s, failError, opErr := updateTx[T](target.StoredModel(), target.Operations.Update, operationTransaction, headers, id, patchRow)
		if opErr != nil {
			panic(model.FailPanic{Err: opErr})
		}
		return s, failError
	})
}

func NestedDelete[T any](c model.Composer, target *model.Model[T], id model.ID) model.Signal {
	operationTransaction, headers := c.OpTx(), c.OpHeaders()
	return c.Savepoint(func() (model.Signal, *model.FailError) {
		s, failError, opErr := deleteTx[T](target.StoredModel(), target.Operations.Delete, operationTransaction, headers, id)
		if opErr != nil {
			panic(model.FailPanic{Err: opErr})
		}
		return s, failError
	})
}

func NestedListFor[T any](c model.Composer, target *model.Model[T], cursor string, extra []model.ListFilter) ([]model.Entity[T], string, model.Signal) {
	operationTransaction, headers := c.OpTx(), c.OpHeaders()
	var ents []model.Entity[T]
	var next string
	signal := c.Savepoint(func() (model.Signal, *model.FailError) {
		signal, n, s, failError, opErr := listTx[T](target.StoredModel(), target, target.Operations.List, operationTransaction, headers, cursor, extra)
		if opErr != nil {
			panic(model.FailPanic{Err: opErr})
		}
		if s == model.Failed {
			return model.Failed, failError
		}
		ents = make([]model.Entity[T], len(signal))
		for i, r := range signal {
			ents[i] = entityFromRecord[T](r)
		}
		next = n
		return s, nil
	})
	return ents, next, signal
}

func inputToRowMap(input any) row.Map {
	switch value := input.(type) {
	case nil:
		return row.Map{}
	case row.Map:
		return serde.FilterInputRow(cloneRowMap(value))
	case map[string]any:
		return serde.FilterInputRow(row.FromAnyMap(value))
	default:
		return serde.ToRow(input)
	}
}

func patchToRowMap(patch any) row.Map {
	switch value := patch.(type) {
	case nil:
		return row.Map{}
	case row.Map:
		return serde.FilterInputRow(cloneRowMap(value))
	case map[string]any:
		return serde.FilterInputRow(row.FromAnyMap(value))
	default:
		return serde.ToPatchRow(patch)
	}
}

func entityFromRecord[T any](r model.Record) model.Entity[T] {
	ent := model.Entity[T]{ID: r.ID, Status: r.Status}
	if d, ok := r.Data.(*T); ok && d != nil {
		ent.Data = *d
	}
	return ent
}
