package runtime

import (
	"context"

	"github.com/fookiejs/fookie/internal/model/flowext"
	"github.com/fookiejs/fookie/internal/model/schemawire"
	"github.com/fookiejs/fookie/internal/persistence/row"
)

type Engine struct {
	Create func(context.Context, map[string]string, row.Values) (schemawire.OpResult, error)
	Read   func(context.Context, map[string]string, schemawire.ID) (schemawire.Record, error)
	Update func(context.Context, map[string]string, schemawire.ID, row.Values) (schemawire.OpResult, error)
	Delete func(context.Context, map[string]string, schemawire.ID) error
	List   func(context.Context, map[string]string, string, []schemawire.ListFilter) ([]schemawire.Record, string, error)
	Resume func(schemawire.ID) error
	Decode func(row.Values) schemawire.Record
}

func BuildEngine[Schema any](application flowext.AppRef, modelDefinition *flowext.Model[Schema]) *Engine {
	stored := modelDefinition.StoredModel()
	operations := modelDefinition.Operations
	return &Engine{
		Create: func(reqCtx context.Context, headers map[string]string, body row.Values) (schemawire.OpResult, error) {
			return runInTxOp(application, reqCtx, headers, func(operationTransaction *flowext.OpTx) (schemawire.OpResult, schemawire.Signal, *schemawire.FailError, error) {
				return createTx(stored, operations.Create, operationTransaction, headers, body)
			})
		},
		Read: func(reqCtx context.Context, headers map[string]string, identifier schemawire.ID) (schemawire.Record, error) {
			return runInTxOp(application, reqCtx, headers, func(operationTransaction *flowext.OpTx) (schemawire.Record, schemawire.Signal, *schemawire.FailError, error) {
				return readTx(stored, operations.Read, operationTransaction, headers, identifier)
			})
		},
		Update: func(reqCtx context.Context, headers map[string]string, identifier schemawire.ID, body row.Values) (schemawire.OpResult, error) {
			return runInTxOp(application, reqCtx, headers, func(operationTransaction *flowext.OpTx) (schemawire.OpResult, schemawire.Signal, *schemawire.FailError, error) {
				return updateTx(stored, operations.Update, operationTransaction, headers, identifier, body)
			})
		},
		Delete: func(reqCtx context.Context, headers map[string]string, identifier schemawire.ID) error {
			_, err := runInTxOp(application, reqCtx, headers, func(operationTransaction *flowext.OpTx) (struct{}, schemawire.Signal, *schemawire.FailError, error) {
				signal, failError, opErr := deleteTx(stored, operations.Delete, operationTransaction, headers, identifier)
				return struct{}{}, signal, failError, opErr
			})
			return err
		},
		List: func(reqCtx context.Context, headers map[string]string, cursor string, extra []schemawire.ListFilter) ([]schemawire.Record, string, error) {
			out, err := runInTxOp(application, reqCtx, headers, func(operationTransaction *flowext.OpTx) (listOut, schemawire.Signal, *schemawire.FailError, error) {
				items, next, signal, failError, opErr := listTx(stored, modelDefinition, operations.List, operationTransaction, headers, cursor, extra)
				return listOut{items: items, next: next}, signal, failError, opErr
			})
			return out.items, out.next, err
		},
		Resume: func(identifier schemawire.ID) error {
			return runResume(application, stored, operations.Create, identifier)
		},
		Decode: func(values row.Values) schemawire.Record { return decodeRecord[Schema](values) },
	}
}
