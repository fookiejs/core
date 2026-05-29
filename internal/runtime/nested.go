package runtime

import (
	"github.com/fookiejs/fookie/internal/model"
	"github.com/fookiejs/fookie/internal/persistence/row"
	"github.com/fookiejs/fookie/internal/persistence/serde"
)

func NestedCreate[Schema any](composer model.Composer, target *model.Model[Schema], input any) (model.ID, model.Signal) {
	bodyRow := inputToRowMap(input)
	operationTransaction, headers := composer.OpTx(), composer.OpHeaders()
	var identifier model.ID
	signal := composer.Savepoint(func() (model.Signal, *model.FailError) {
		result, operationSignal, failError, opErr := createTx[Schema](target.StoredModel(), target.Operations.Create, operationTransaction, headers, bodyRow)
		if opErr != nil {
			panic(model.FailPanic{Err: opErr})
		}
		if operationSignal == model.Failed {
			return model.Failed, failError
		}
		identifier = result.ID
		return operationSignal, nil
	})
	return identifier, signal
}

func NestedRead[Schema any](composer model.Composer, target *model.Model[Schema], id model.ID) (model.Entity[Schema], model.Signal) {
	operationTransaction, headers := composer.OpTx(), composer.OpHeaders()
	var entity model.Entity[Schema]
	signal := composer.Savepoint(func() (model.Signal, *model.FailError) {
		record, operationSignal, failError, opErr := readTx[Schema](target.StoredModel(), target.Operations.Read, operationTransaction, headers, id)
		if opErr != nil {
			panic(model.FailPanic{Err: opErr})
		}
		if operationSignal == model.Failed {
			return model.Failed, failError
		}
		entity = entityFromRecord[Schema](record)
		return operationSignal, nil
	})
	return entity, signal
}

func NestedUpdate[Schema any](composer model.Composer, target *model.Model[Schema], id model.ID, patch any) model.Signal {
	patchRow := patchToRowMap(patch)
	operationTransaction, headers := composer.OpTx(), composer.OpHeaders()
	return composer.Savepoint(func() (model.Signal, *model.FailError) {
		_, operationSignal, failError, opErr := updateTx[Schema](target.StoredModel(), target.Operations.Update, operationTransaction, headers, id, patchRow)
		if opErr != nil {
			panic(model.FailPanic{Err: opErr})
		}
		return operationSignal, failError
	})
}

func NestedDelete[Schema any](composer model.Composer, target *model.Model[Schema], id model.ID) model.Signal {
	operationTransaction, headers := composer.OpTx(), composer.OpHeaders()
	return composer.Savepoint(func() (model.Signal, *model.FailError) {
		operationSignal, failError, opErr := deleteTx[Schema](target.StoredModel(), target.Operations.Delete, operationTransaction, headers, id)
		if opErr != nil {
			panic(model.FailPanic{Err: opErr})
		}
		return operationSignal, failError
	})
}

func NestedListFor[Schema any](composer model.Composer, target *model.Model[Schema], cursor string, extra []model.ListFilter) ([]model.Entity[Schema], string, model.Signal) {
	operationTransaction, headers := composer.OpTx(), composer.OpHeaders()
	var entities []model.Entity[Schema]
	var next string
	signal := composer.Savepoint(func() (model.Signal, *model.FailError) {
		records, nextCursor, operationSignal, failError, opErr := listTx[Schema](target.StoredModel(), target, target.Operations.List, operationTransaction, headers, cursor, extra)
		if opErr != nil {
			panic(model.FailPanic{Err: opErr})
		}
		if operationSignal == model.Failed {
			return model.Failed, failError
		}
		entities = make([]model.Entity[Schema], len(records))
		for index, record := range records {
			entities[index] = entityFromRecord[Schema](record)
		}
		next = nextCursor
		return operationSignal, nil
	})
	return entities, next, signal
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

func entityFromRecord[Schema any](record model.Record) model.Entity[Schema] {
	entity := model.Entity[Schema]{ID: record.ID, Status: record.Status}
	if typedData, ok := record.Data.(*Schema); ok && typedData != nil {
		entity.Data = *typedData
	}
	return entity
}
