package runtime

import (
	"github.com/fookiejs/fookie/internal/model"
	"github.com/fookiejs/fookie/internal/persistence/row"
	"github.com/fookiejs/fookie/internal/persistence/serde"
)

func NestedCreate[T any](c model.Composer, target *model.Model[T], input any) (model.ID, model.Signal) {
	bodyRow := inputToRowMap(input)
	otx, headers := c.OpTx(), c.OpHeaders()
	var id model.ID
	sig := c.Savepoint(func() (model.Signal, *model.FailError) {
		res, s, ferr, opErr := createTx[T](target.StoredModel(), target.Operations.Create, otx, headers, bodyRow)
		if opErr != nil {
			panic(model.FailPanic{Err: opErr})
		}
		if s == model.Failed {
			return model.Failed, ferr
		}
		id = res.ID
		return s, nil
	})
	return id, sig
}

func NestedRead[T any](c model.Composer, target *model.Model[T], id model.ID) (model.Entity[T], model.Signal) {
	otx, headers := c.OpTx(), c.OpHeaders()
	var ent model.Entity[T]
	sig := c.Savepoint(func() (model.Signal, *model.FailError) {
		rec, s, ferr, opErr := readTx[T](target.StoredModel(), target.Operations.Read, otx, headers, id)
		if opErr != nil {
			panic(model.FailPanic{Err: opErr})
		}
		if s == model.Failed {
			return model.Failed, ferr
		}
		ent = entityFromRecord[T](rec)
		return s, nil
	})
	return ent, sig
}

func NestedUpdate[T any](c model.Composer, target *model.Model[T], id model.ID, patch any) model.Signal {
	patchRow := patchToRowMap(patch)
	otx, headers := c.OpTx(), c.OpHeaders()
	return c.Savepoint(func() (model.Signal, *model.FailError) {
		_, s, ferr, opErr := updateTx[T](target.StoredModel(), target.Operations.Update, otx, headers, id, patchRow)
		if opErr != nil {
			panic(model.FailPanic{Err: opErr})
		}
		return s, ferr
	})
}

func NestedDelete[T any](c model.Composer, target *model.Model[T], id model.ID) model.Signal {
	otx, headers := c.OpTx(), c.OpHeaders()
	return c.Savepoint(func() (model.Signal, *model.FailError) {
		s, ferr, opErr := deleteTx[T](target.StoredModel(), target.Operations.Delete, otx, headers, id)
		if opErr != nil {
			panic(model.FailPanic{Err: opErr})
		}
		return s, ferr
	})
}

func NestedListFor[T any](c model.Composer, target *model.Model[T], cursor string, extra []model.ListFilter) ([]model.Entity[T], string, model.Signal) {
	otx, headers := c.OpTx(), c.OpHeaders()
	var ents []model.Entity[T]
	var next string
	sig := c.Savepoint(func() (model.Signal, *model.FailError) {
		records, n, s, ferr, opErr := listTx[T](target.StoredModel(), target, target.Operations.List, otx, headers, cursor, extra)
		if opErr != nil {
			panic(model.FailPanic{Err: opErr})
		}
		if s == model.Failed {
			return model.Failed, ferr
		}
		ents = make([]model.Entity[T], len(records))
		for i, r := range records {
			ents[i] = entityFromRecord[T](r)
		}
		next = n
		return s, nil
	})
	return ents, next, sig
}

func inputToRowMap(input any) row.Map {
	switch v := input.(type) {
	case nil:
		return row.Map{}
	case row.Map:
		return cloneRowMap(v)
	case map[string]any:
		return row.FromAnyMap(v)
	default:
		return serde.ToRow(input)
	}
}

func patchToRowMap(patch any) row.Map {
	switch v := patch.(type) {
	case nil:
		return row.Map{}
	case row.Map:
		return cloneRowMap(v)
	case map[string]any:
		return row.FromAnyMap(v)
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
