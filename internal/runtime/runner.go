package runtime

import (
	"context"
	"encoding/json"

	"github.com/fookiejs/fookie/internal/model"
	"github.com/fookiejs/fookie/internal/observability"
	"github.com/fookiejs/fookie/internal/persistence/row"
	"github.com/fookiejs/fookie/internal/persistence/serde"
	"github.com/fookiejs/fookie/internal/persistence/store"
	"github.com/fookiejs/fookie/internal/platform"
	"github.com/jackc/pgx/v5"
)

func createTx[Schema any](stored *model.StoredModel, operation func(*model.Flow[Schema]) model.Signal, operationTransaction *model.OpTx, headers map[string]string, bodyRow row.Values) (model.OpResult, model.Signal, *model.FailError, error) {
	if existing, err := store.FindExistingByUnique(operationTransaction.Ctx, operationTransaction.Tx, model.TableFor(stored), bodyRow); err != nil {
		return model.OpResult{}, model.Failed, nil, err
	} else if existing != nil {
		return resumeExisting[Schema](operationTransaction, stored, operation, headers, existing)
	}

	entityID := model.NewID()
	var body Schema
	serde.IntoStruct(bodyRow, &body)
	execCtx := observability.FlowStarted(operationTransaction.Ctx, stored.Name, entityID.String())
	flow := model.NewEntityOpFlow(execCtx, operationTransaction.App, stored, entityID.String(), headers, body, operationTransaction, "")
	signal, failError := model.RunOp(operation, flow)
	if signal == model.Failed {
		_ = flow.CompensateAll()
		return model.OpResult{}, signal, failError, nil
	}
	status := model.EntityStatusActive
	if signal == model.Running {
		status = model.EntityStatusPending
	} else if verr := model.ValidateBody(flow.Body); verr != nil {
		return model.OpResult{}, model.Failed, verr, nil
	}

	data := serde.Values(flow.Body)
	data = data.Upsert("id", row.FromText(entityID.String()))
	data = applyBaseOnCreate(data, platform.NowRFC3339())

	if _, err := store.InsertTx(operationTransaction.Tx, model.TableFor(stored), data); err != nil {
		if existing, lerr := store.FindExistingByUnique(operationTransaction.Ctx, operationTransaction.Tx, model.TableFor(stored), bodyRow); lerr == nil && existing != nil {
			return resumeExisting[Schema](operationTransaction, stored, operation, headers, existing)
		}
		return model.OpResult{}, model.Failed, nil, err
	}
	if err := store.SetEntityStatusTx(operationTransaction.Tx, model.TableFor(stored), entityID.String(), status.String()); err != nil {
		return model.OpResult{}, model.Failed, nil, err
	}
	headersJSON, _ := json.Marshal(headers)
	if err := store.SetEntityHeadersTx(operationTransaction.Tx, model.TableFor(stored), entityID.String(), headersJSON); err != nil {
		return model.OpResult{}, model.Failed, nil, err
	}

	if signal == model.Running {
		observability.FlowSuspended(execCtx, stored.Name, entityID.String(), nil)
	} else {
		observability.FlowCompleted(execCtx, stored.Name, entityID.String())
	}
	return model.OpResult{ID: entityID, Pending: status == model.EntityStatusPending}, signal, nil, nil
}

func resumeExisting[Schema any](operationTransaction *model.OpTx, stored *model.StoredModel, operation func(*model.Flow[Schema]) model.Signal, headers map[string]string, existing row.Values) (model.OpResult, model.Signal, *model.FailError, error) {
	entityID := model.ID(existing.RequireText("id"))
	status := model.EntityStatus(existing.TextOr("_fookie_status", ""))
	if status == model.EntityStatusActive {
		return model.OpResult{ID: entityID}, model.Done, nil, nil
	}
	resolvedHeaders := headersFromEntity(existing, headers)
	signal, failError, err := resumeEntityInTx[Schema](operationTransaction, stored, operation, entityID, resolvedHeaders, existing, status == model.EntityStatusFailed)
	if err != nil {
		return model.OpResult{}, model.Failed, failError, err
	}
	if signal == model.Failed {
		return model.OpResult{}, signal, failError, nil
	}
	return model.OpResult{ID: entityID, Pending: signal == model.Running}, signal, nil, nil
}

func resumeEntityInTx[Schema any](operationTransaction *model.OpTx, stored *model.StoredModel, operation func(*model.Flow[Schema]) model.Signal, entityID model.ID, headers map[string]string, existing row.Values, resetFailed bool) (model.Signal, *model.FailError, error) {
	if resetFailed {
		if err := store.SetEntityStatusTx(operationTransaction.Tx, model.TableFor(stored), entityID.String(), model.EntityStatusPending.String()); err != nil {
			return model.Failed, nil, err
		}
	}
	var body Schema
	serde.IntoStruct(existing, &body)
	execCtx := observability.SchedulerResume(operationTransaction.Ctx, stored.Name, entityID.String())
	execCtx = observability.FlowResumed(execCtx, stored.Name, entityID.String())
	traceID := observability.TraceIDForEntity(entityID.String(), platform.NewUUIDv7)
	flow := model.NewEntityOpFlow(execCtx, operationTransaction.App, stored, entityID.String(), headers, body, operationTransaction, traceID)
	signal, failError := model.RunOp(operation, flow)
	if signal == model.Failed {
		_ = flow.CompensateAll()
		return signal, failError, nil
	}
	status := model.EntityStatusActive
	if signal == model.Running {
		status = model.EntityStatusPending
	} else if verr := model.ValidateBody(flow.Body); verr != nil {
		return model.Failed, verr, nil
	}
	data := serde.Values(flow.Body)
	data = data.Upsert("id", row.FromText(entityID.String()))
	data = touchUpdatedAt(data, platform.NowRFC3339())
	if _, err := store.UpdateTx(operationTransaction.Tx, model.TableFor(stored), entityID.String(), data); err != nil {
		return model.Failed, nil, err
	}
	if err := store.SetEntityStatusTx(operationTransaction.Tx, model.TableFor(stored), entityID.String(), status.String()); err != nil {
		return model.Failed, nil, err
	}
	if signal == model.Running {
		observability.FlowSuspended(execCtx, stored.Name, entityID.String(), nil)
	} else {
		observability.FlowCompleted(execCtx, stored.Name, entityID.String())
	}
	return signal, nil, nil
}

func readTx[Schema any](stored *model.StoredModel, operation func(*model.Flow[Schema]) model.Signal, operationTransaction *model.OpTx, headers map[string]string, identifier model.ID) (model.Record, model.Signal, *model.FailError, error) {
	data, err := store.ReadTx(operationTransaction.Tx, model.TableFor(stored), identifier.String())
	if err != nil {
		return model.Record{}, model.Failed, nil, err
	}
	var body Schema
	serde.IntoStruct(data, &body)
	flow := model.NewBoundFlow(operationTransaction.Ctx, operationTransaction.App, stored, identifier.String(), headers, body, operationTransaction)
	signal, failError := model.RunOp(operation, flow)
	if signal == model.Failed {
		return model.Record{}, signal, failError, nil
	}
	return model.Record{
		ID:     identifier,
		Status: model.EntityStatus(data.TextOr("_fookie_status", "")),
		Error:  data.TextOr("_fookie_error", ""),
		Data:   &flow.Body,
	}, signal, nil, nil
}

func updateTx[Schema any](stored *model.StoredModel, operation func(*model.Flow[Schema]) model.Signal, operationTransaction *model.OpTx, headers map[string]string, identifier model.ID, bodyRow row.Values) (model.OpResult, model.Signal, *model.FailError, error) {
	existing, err := store.ReadTx(operationTransaction.Tx, model.TableFor(stored), identifier.String())
	if err != nil {
		return model.OpResult{}, model.Failed, nil, err
	}
	merged := mergeRowPatch(existing, bodyRow)
	var body Schema
	serde.IntoStruct(merged, &body)
	flow := model.NewBoundFlow(operationTransaction.Ctx, operationTransaction.App, stored, identifier.String(), headers, body, operationTransaction)
	signal, failError := model.RunOp(operation, flow)
	if signal == model.Failed {
		_ = flow.CompensateAll()
		return model.OpResult{}, signal, failError, nil
	}
	data := serde.Values(flow.Body)
	data = data.Remove("id")
	if verr := model.ValidateBody(flow.Body); verr != nil {
		return model.OpResult{}, model.Failed, verr, nil
	}
	data = touchUpdatedAt(data, platform.NowRFC3339())
	if _, err := store.UpdateTx(operationTransaction.Tx, model.TableFor(stored), identifier.String(), data); err != nil {
		return model.OpResult{}, model.Failed, nil, err
	}
	if signal == model.Running {
		if err := store.SetEntityStatusTx(operationTransaction.Tx, model.TableFor(stored), identifier.String(), model.EntityStatusPending.String()); err != nil {
			return model.OpResult{}, model.Failed, nil, err
		}
	}
	return model.OpResult{ID: identifier, Pending: signal == model.Running}, signal, nil, nil
}

func deleteTx[Schema any](stored *model.StoredModel, operation func(*model.Flow[Schema]) model.Signal, operationTransaction *model.OpTx, headers map[string]string, identifier model.ID) (model.Signal, *model.FailError, error) {
	data, err := store.ReadTx(operationTransaction.Tx, model.TableFor(stored), identifier.String())
	if err != nil {
		return model.Failed, nil, err
	}
	var body Schema
	serde.IntoStruct(data, &body)
	flow := model.NewBoundFlow(operationTransaction.Ctx, operationTransaction.App, stored, identifier.String(), headers, body, operationTransaction)
	signal, failError := model.RunOp(operation, flow)
	if signal == model.Failed {
		return signal, failError, nil
	}
	if err := store.DeleteTx(operationTransaction.Tx, model.TableFor(stored), identifier.String(), platform.NowRFC3339()); err != nil {
		return model.Failed, nil, err
	}
	return signal, nil, nil
}

func listTx[Schema any](stored *model.StoredModel, modelDefinition *model.Model[Schema], operation func(*model.ListFlow[Schema]) model.Signal, operationTransaction *model.OpTx, headers map[string]string, cursor string, extra []model.ListFilter) ([]model.Record, string, model.Signal, *model.FailError, error) {
	flow := model.NewListFlow(operationTransaction.Ctx, stored, modelDefinition.Field)
	flow.Headers = headers
	flow.SetApp(operationTransaction.App)
	if signal, failError := model.RunListOp(operation, flow); signal == model.Failed {
		return nil, "", signal, failError, nil
	}
	flow.ApplyExtraFilters(extra)
	flow.ApplyPagination(cursor, operationTransaction.App.ListLimit())
	items, next, err := flow.ListItemsTx(operationTransaction)
	if err != nil {
		return nil, "", model.Failed, nil, err
	}
	records := make([]model.Record, len(items))
	for index := range items {
		records[index] = decodeRecord[Schema](items[index])
	}
	return records, next, model.Done, nil, nil
}

func resumeTx[Schema any](stored *model.StoredModel, operation func(*model.Flow[Schema]) model.Signal, operationTransaction *model.OpTx, headers map[string]string, entityID model.ID) (model.Signal, *model.FailError, error) {
	data, err := store.ReadTx(operationTransaction.Tx, model.TableFor(stored), entityID.String())
	if err != nil {
		return model.Failed, nil, err
	}
	resolvedHeaders := headersFromEntity(data, headers)
	return resumeEntityInTx[Schema](operationTransaction, stored, operation, entityID, resolvedHeaders, data, false)
}

func runInTxOp[Result any](application model.AppRef, reqCtx context.Context, headers map[string]string, callback func(*model.OpTx) (Result, model.Signal, *model.FailError, error)) (Result, error) {
	var result Result
	_, failError, err := model.RunInTx(reqCtx, application.DB(), func(transaction pgx.Tx) (model.Signal, *model.FailError, error) {
		operationTransaction := model.NewOpTx(reqCtx, transaction, application, headers)
		out, signal, opFerr, opErr := callback(operationTransaction)
		if opErr != nil {
			return model.Failed, opFerr, opErr
		}
		if signal == model.Failed {
			return model.Failed, opFerr, nil
		}
		result = out
		return signal, nil, nil
	})
	if err != nil {
		var zero Result
		return zero, err
	}
	if failError != nil {
		var zero Result
		return zero, failError
	}
	return result, nil
}

type listOut struct {
	items []model.Record
	next  string
}

func runCreate[Schema any](application model.AppRef, stored *model.StoredModel, operation func(*model.Flow[Schema]) model.Signal, reqCtx context.Context, headers map[string]string, bodyRow row.Values) (model.OpResult, error) {
	return runInTxOp(application, reqCtx, headers, func(operationTransaction *model.OpTx) (model.OpResult, model.Signal, *model.FailError, error) {
		return createTx(stored, operation, operationTransaction, headers, bodyRow)
	})
}

func runRead[Schema any](application model.AppRef, stored *model.StoredModel, operation func(*model.Flow[Schema]) model.Signal, reqCtx context.Context, headers map[string]string, identifier model.ID) (model.Record, error) {
	return runInTxOp(application, reqCtx, headers, func(operationTransaction *model.OpTx) (model.Record, model.Signal, *model.FailError, error) {
		return readTx(stored, operation, operationTransaction, headers, identifier)
	})
}

func runUpdate[Schema any](application model.AppRef, stored *model.StoredModel, operation func(*model.Flow[Schema]) model.Signal, reqCtx context.Context, headers map[string]string, identifier model.ID, bodyRow row.Values) (model.OpResult, error) {
	return runInTxOp(application, reqCtx, headers, func(operationTransaction *model.OpTx) (model.OpResult, model.Signal, *model.FailError, error) {
		return updateTx(stored, operation, operationTransaction, headers, identifier, bodyRow)
	})
}

func runDelete[Schema any](application model.AppRef, stored *model.StoredModel, operation func(*model.Flow[Schema]) model.Signal, reqCtx context.Context, headers map[string]string, identifier model.ID) error {
	_, err := runInTxOp(application, reqCtx, headers, func(operationTransaction *model.OpTx) (struct{}, model.Signal, *model.FailError, error) {
		signal, failError, opErr := deleteTx(stored, operation, operationTransaction, headers, identifier)
		return struct{}{}, signal, failError, opErr
	})
	return err
}

func runList[Schema any](application model.AppRef, stored *model.StoredModel, modelDefinition *model.Model[Schema], operation func(*model.ListFlow[Schema]) model.Signal, reqCtx context.Context, headers map[string]string, cursor string, extra []model.ListFilter) ([]model.Record, string, error) {
	out, err := runInTxOp(application, reqCtx, headers, func(operationTransaction *model.OpTx) (listOut, model.Signal, *model.FailError, error) {
		items, next, signal, failError, opErr := listTx(stored, modelDefinition, operation, operationTransaction, headers, cursor, extra)
		return listOut{items: items, next: next}, signal, failError, opErr
	})
	return out.items, out.next, err
}

func runResume[Schema any](application model.AppRef, stored *model.StoredModel, operation func(*model.Flow[Schema]) model.Signal, entityID model.ID) error {
	reqCtx := context.Background()
	headers := map[string]string{}
	_, failError, err := model.RunInTx(reqCtx, application.DB(), func(transaction pgx.Tx) (model.Signal, *model.FailError, error) {
		data, readErr := store.ReadTx(transaction, model.TableFor(stored), entityID.String())
		if readErr != nil {
			return model.Failed, nil, readErr
		}
		resolvedHeaders := headersFromEntity(data, headers)
		operationTransaction := model.NewOpTx(reqCtx, transaction, application, resolvedHeaders)
		signal, opFerr, opErr := resumeTx(stored, operation, operationTransaction, resolvedHeaders, entityID)
		if opErr != nil {
			return model.Failed, opFerr, opErr
		}
		return signal, opFerr, nil
	})
	if err != nil {
		model.MarkEntityFailed(reqCtx, application, stored, entityID.String(), err.Error(), "")
		return err
	}
	if failError != nil {
		model.MarkEntityFailed(reqCtx, application, stored, entityID.String(), failError.Error(), "")
		return failError
	}
	return nil
}

func decodeRecord[Schema any](data row.Values) model.Record {
	var schemaValue Schema
	serde.IntoStruct(data, &schemaValue)
	return model.Record{
		ID:     model.ID(data.RequireText("id")),
		Status: model.EntityStatus(data.TextOr("_fookie_status", "")),
		Error:  data.TextOr("_fookie_error", ""),
		Data:   &schemaValue,
	}
}

const (
	colCreatedAt = "created_at"
	colUpdatedAt = "updated_at"
	colIsDeleted = "is_deleted"
)

func applyBaseOnCreate(data row.Values, now string) row.Values {
	data = data.Upsert(colCreatedAt, row.FromText(now))
	data = data.Upsert(colUpdatedAt, row.FromText(now))
	return data.Upsert(colIsDeleted, row.FromTruth(false))
}

func touchUpdatedAt(data row.Values, now string) row.Values {
	return data.Upsert(colUpdatedAt, row.FromText(now))
}

func headersFromEntity(data row.Values, fallback map[string]string) map[string]string {
	if cell, ok := data.Find("_fookie_headers"); ok && cell.Kind == row.KindText && len(cell.Text) > 0 {
		parsed := map[string]string{}
		_ = json.Unmarshal([]byte(cell.Text), &parsed)
		return parsed
	}
	out := map[string]string{}
	for key, value := range fallback {
		out[key] = value
	}
	return out
}

func mergeRowPatch(existing, patch row.Values) row.Values {
	out := existing.Clone()
	for _, field := range patch {
		if field.Column == "id" || field.Column == "_fookie_status" || field.Column == "_fookie_error" || field.Column == "_fookie_headers" || serde.IsProtectedBaseColumn(field.Column) {
			continue
		}
		out = out.Upsert(field.Column, field.Cell)
	}
	return out
}
