package runtime

import (
	"github.com/fookiejs/fookie/internal/model/flowext"
	"github.com/fookiejs/fookie/internal/model/schemawire"
	"github.com/fookiejs/fookie/internal/persistence/row"
	"github.com/fookiejs/fookie/internal/persistence/serde"
)

func NestedCreate[Schema any](composer flowext.Composer, target *flowext.Model[Schema], input any) (schemawire.ID, schemawire.Signal) {
	bodyRow := anyToRowValues(input, false)
	operationTransaction, headers := composer.OpTx(), composer.OpHeaders()
	var identifier schemawire.ID
	signal := composer.Savepoint(func() (schemawire.Signal, *schemawire.FailError) {
		result, operationSignal, failError, opErr := createTx[Schema](target.StoredModel(), target.Operations.Create, operationTransaction, headers, bodyRow)
		if opErr != nil {
			panic(schemawire.FailPanic{Err: opErr})
		}
		if operationSignal == schemawire.Failed {
			return schemawire.Failed, failError
		}
		identifier = result.ID
		return operationSignal, nil
	})
	return identifier, signal
}

func NestedRead[Schema any](composer flowext.Composer, target *flowext.Model[Schema], id schemawire.ID) (schemawire.Entity[Schema], schemawire.Signal) {
	operationTransaction, headers := composer.OpTx(), composer.OpHeaders()
	var entity schemawire.Entity[Schema]
	signal := composer.Savepoint(func() (schemawire.Signal, *schemawire.FailError) {
		record, operationSignal, failError, opErr := readTx[Schema](target.StoredModel(), target.Operations.Read, operationTransaction, headers, id)
		if opErr != nil {
			panic(schemawire.FailPanic{Err: opErr})
		}
		if operationSignal == schemawire.Failed {
			return schemawire.Failed, failError
		}
		entity = entityFromRecord[Schema](record)
		return operationSignal, nil
	})
	return entity, signal
}

func NestedUpdate[Schema any](composer flowext.Composer, target *flowext.Model[Schema], id schemawire.ID, patch any) schemawire.Signal {
	patchRow := anyToRowValues(patch, true)
	operationTransaction, headers := composer.OpTx(), composer.OpHeaders()
	return composer.Savepoint(func() (schemawire.Signal, *schemawire.FailError) {
		_, operationSignal, failError, opErr := updateTx[Schema](target.StoredModel(), target.Operations.Update, operationTransaction, headers, id, patchRow)
		if opErr != nil {
			panic(schemawire.FailPanic{Err: opErr})
		}
		return operationSignal, failError
	})
}

func NestedDelete[Schema any](composer flowext.Composer, target *flowext.Model[Schema], id schemawire.ID) schemawire.Signal {
	operationTransaction, headers := composer.OpTx(), composer.OpHeaders()
	return composer.Savepoint(func() (schemawire.Signal, *schemawire.FailError) {
		operationSignal, failError, opErr := deleteTx[Schema](target.StoredModel(), target.Operations.Delete, operationTransaction, headers, id)
		if opErr != nil {
			panic(schemawire.FailPanic{Err: opErr})
		}
		return operationSignal, failError
	})
}

func NestedListFor[Schema any](composer flowext.Composer, target *flowext.Model[Schema], cursor string, extra []schemawire.ListFilter) ([]schemawire.Entity[Schema], string, schemawire.Signal) {
	operationTransaction, headers := composer.OpTx(), composer.OpHeaders()
	var entities []schemawire.Entity[Schema]
	var next string
	signal := composer.Savepoint(func() (schemawire.Signal, *schemawire.FailError) {
		records, nextCursor, operationSignal, failError, opErr := listTx[Schema](target.StoredModel(), target, target.Operations.List, operationTransaction, headers, cursor, extra)
		if opErr != nil {
			panic(schemawire.FailPanic{Err: opErr})
		}
		if operationSignal == schemawire.Failed {
			return schemawire.Failed, failError
		}
		entities = make([]schemawire.Entity[Schema], len(records))
		for index, record := range records {
			entities[index] = entityFromRecord[Schema](record)
		}
		next = nextCursor
		return operationSignal, nil
	})
	return entities, next, signal
}

func anyToRowValues(input any, patch bool) row.Values {
	switch value := input.(type) {
	case nil:
		return row.Values{}
	case row.Values:
		return serde.FilterInputRow(value.Clone())
	default:
		if patch {
			return serde.PatchValues(input)
		}
		return serde.Values(input)
	}
}

func entityFromRecord[Schema any](record schemawire.Record) schemawire.Entity[Schema] {
	entity := schemawire.Entity[Schema]{ID: record.ID, Status: record.Status}
	if typedData, ok := record.Data.(*Schema); ok && typedData != nil {
		entity.Data = *typedData
	}
	return entity
}
