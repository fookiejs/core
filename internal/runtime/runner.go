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

func createTx[S any](stored *model.StoredModel, operation func(*model.Flow[S]) model.Signal, operationTransaction *model.OpTx, headers map[string]string, bodyRow row.Map) (model.OpResult, model.Signal, *model.FailError, error) {
	if existing, err := store.FindExistingByUnique(operationTransaction.Ctx, operationTransaction.Tx, model.TableFor(stored), bodyRow); err != nil {
		return model.OpResult{}, model.Failed, nil, err
	} else if existing != nil {
		return resumeExisting[S](operationTransaction, stored, operation, headers, existing)
	}

	entityID := model.NewID()
	var body S
	serde.FromRow(bodyRow, &body)
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

	data := serde.ToRow(flow.Body)
	data["id"] = row.FromText(entityID.String())
	stripInternal(data)
	now := platform.NowRFC3339()
	applyBaseOnCreate(data, now)

	if _, err := store.InsertTx(operationTransaction.Tx, model.TableFor(stored), data); err != nil {
		if existing, lerr := store.FindExistingByUnique(operationTransaction.Ctx, operationTransaction.Tx, model.TableFor(stored), bodyRow); lerr == nil && existing != nil {
			return resumeExisting[S](operationTransaction, stored, operation, headers, existing)
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

func resumeExisting[S any](operationTransaction *model.OpTx, stored *model.StoredModel, operation func(*model.Flow[S]) model.Signal, headers map[string]string, existing row.Map) (model.OpResult, model.Signal, *model.FailError, error) {
	entityID := model.ID(existing.RequireText("id"))
	status := model.EntityStatus(existing.TextOr("_fookie_status", ""))
	if status == model.EntityStatusActive {
		return model.OpResult{ID: entityID}, model.Done, nil, nil
	}
	h := headersFromEntity(existing, headers)
	signal, failError, err := resumeEntityInTx[S](operationTransaction, stored, operation, entityID, h, existing, status == model.EntityStatusFailed)
	if err != nil {
		return model.OpResult{}, model.Failed, failError, err
	}
	if signal == model.Failed {
		return model.OpResult{}, signal, failError, nil
	}
	return model.OpResult{ID: entityID, Pending: signal == model.Running}, signal, nil, nil
}

func resumeEntityInTx[S any](operationTransaction *model.OpTx, stored *model.StoredModel, operation func(*model.Flow[S]) model.Signal, entityID model.ID, headers map[string]string, existing row.Map, resetFailed bool) (model.Signal, *model.FailError, error) {
	if resetFailed {
		if err := store.SetEntityStatusTx(operationTransaction.Tx, model.TableFor(stored), entityID.String(), model.EntityStatusPending.String()); err != nil {
			return model.Failed, nil, err
		}
	}
	data := cloneRowMap(existing)
	stripInternal(data)
	var body S
	serde.FromRow(data, &body)
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
	rowData := serde.ToRow(flow.Body)
	rowData["id"] = row.FromText(entityID.String())
	stripInternal(rowData)
	now := platform.NowRFC3339()
	touchUpdatedAt(rowData, now)
	if _, err := store.UpdateTx(operationTransaction.Tx, model.TableFor(stored), entityID.String(), rowData); err != nil {
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

func readTx[S any](stored *model.StoredModel, operation func(*model.Flow[S]) model.Signal, operationTransaction *model.OpTx, headers map[string]string, identifier model.ID) (model.Record, model.Signal, *model.FailError, error) {
	data, err := store.ReadTx(operationTransaction.Tx, model.TableFor(stored), identifier.String())
	if err != nil {
		return model.Record{}, model.Failed, nil, err
	}
	var body S
	serde.FromRow(data, &body)
	flow := model.NewBoundFlow(operationTransaction.Ctx, operationTransaction.App, stored, identifier.String(), headers, body, operationTransaction)
	signal, failError := model.RunOp(operation, flow)
	if signal == model.Failed {
		return model.Record{}, signal, failError, nil
	}
	return model.Record{
		ID:     identifier,
		Status: model.EntityStatus(data["_fookie_status"].Text),
		Error:  data["_fookie_error"].Text,
		Data:   &flow.Body,
	}, signal, nil, nil
}

func updateTx[S any](stored *model.StoredModel, operation func(*model.Flow[S]) model.Signal, operationTransaction *model.OpTx, headers map[string]string, identifier model.ID, bodyRow row.Map) (model.OpResult, model.Signal, *model.FailError, error) {
	existing, err := store.ReadTx(operationTransaction.Tx, model.TableFor(stored), identifier.String())
	if err != nil {
		return model.OpResult{}, model.Failed, nil, err
	}
	merged := mergeRowPatch(existing, bodyRow)
	var body S
	serde.FromRow(merged, &body)
	flow := model.NewBoundFlow(operationTransaction.Ctx, operationTransaction.App, stored, identifier.String(), headers, body, operationTransaction)
	signal, failError := model.RunOp(operation, flow)
	if signal == model.Failed {
		_ = flow.CompensateAll()
		return model.OpResult{}, signal, failError, nil
	}
	data := serde.ToRow(flow.Body)
	delete(data, "id")
	stripInternal(data)
	if verr := model.ValidateBody(flow.Body); verr != nil {
		return model.OpResult{}, model.Failed, verr, nil
	}
	touchUpdatedAt(data, platform.NowRFC3339())
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

func deleteTx[S any](stored *model.StoredModel, operation func(*model.Flow[S]) model.Signal, operationTransaction *model.OpTx, headers map[string]string, identifier model.ID) (model.Signal, *model.FailError, error) {
	data, err := store.ReadTx(operationTransaction.Tx, model.TableFor(stored), identifier.String())
	if err != nil {
		return model.Failed, nil, err
	}
	var body S
	serde.FromRow(data, &body)
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

func listTx[S any](stored *model.StoredModel, m *model.Model[S], operation func(*model.ListFlow[S]) model.Signal, operationTransaction *model.OpTx, headers map[string]string, cursor string, extra []model.ListFilter) ([]model.Record, string, model.Signal, *model.FailError, error) {
	flow := model.NewListFlow(operationTransaction.Ctx, stored, m.Field)
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
	for i := range items {
		records[i] = decodeRecord[S](items[i])
	}
	return records, next, model.Done, nil, nil
}

func resumeTx[S any](stored *model.StoredModel, operation func(*model.Flow[S]) model.Signal, operationTransaction *model.OpTx, headers map[string]string, entityID model.ID) (model.Signal, *model.FailError, error) {
	data, err := store.ReadTx(operationTransaction.Tx, model.TableFor(stored), entityID.String())
	if err != nil {
		return model.Failed, nil, err
	}
	h := headersFromEntity(data, headers)
	return resumeEntityInTx[S](operationTransaction, stored, operation, entityID, h, data, false)
}

func runInTxOp[R any](a model.AppRef, reqCtx context.Context, headers map[string]string, callback func(*model.OpTx) (R, model.Signal, *model.FailError, error)) (R, error) {
	var result R
	_, failError, err := model.RunInTx(reqCtx, a.DB(), func(transaction pgx.Tx) (model.Signal, *model.FailError, error) {
		operationTransaction := model.NewOpTx(reqCtx, transaction, a, headers)
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
		var zero R
		return zero, err
	}
	if failError != nil {
		var zero R
		return zero, failError
	}
	return result, nil
}

type listOut struct {
	items []model.Record
	next  string
}

func runCreate[S any](a model.AppRef, stored *model.StoredModel, operation func(*model.Flow[S]) model.Signal, reqCtx context.Context, headers map[string]string, bodyRow row.Map) (model.OpResult, error) {
	return runInTxOp(a, reqCtx, headers, func(operationTransaction *model.OpTx) (model.OpResult, model.Signal, *model.FailError, error) {
		return createTx(stored, operation, operationTransaction, headers, bodyRow)
	})
}

func runRead[S any](a model.AppRef, stored *model.StoredModel, operation func(*model.Flow[S]) model.Signal, reqCtx context.Context, headers map[string]string, id model.ID) (model.Record, error) {
	return runInTxOp(a, reqCtx, headers, func(operationTransaction *model.OpTx) (model.Record, model.Signal, *model.FailError, error) {
		return readTx(stored, operation, operationTransaction, headers, id)
	})
}

func runUpdate[S any](a model.AppRef, stored *model.StoredModel, operation func(*model.Flow[S]) model.Signal, reqCtx context.Context, headers map[string]string, id model.ID, bodyRow row.Map) (model.OpResult, error) {
	return runInTxOp(a, reqCtx, headers, func(operationTransaction *model.OpTx) (model.OpResult, model.Signal, *model.FailError, error) {
		return updateTx(stored, operation, operationTransaction, headers, id, bodyRow)
	})
}

func runDelete[S any](a model.AppRef, stored *model.StoredModel, operation func(*model.Flow[S]) model.Signal, reqCtx context.Context, headers map[string]string, id model.ID) error {
	_, err := runInTxOp(a, reqCtx, headers, func(operationTransaction *model.OpTx) (struct{}, model.Signal, *model.FailError, error) {
		signal, failError, opErr := deleteTx(stored, operation, operationTransaction, headers, id)
		return struct{}{}, signal, failError, opErr
	})
	return err
}

func runList[S any](a model.AppRef, stored *model.StoredModel, m *model.Model[S], operation func(*model.ListFlow[S]) model.Signal, reqCtx context.Context, headers map[string]string, cursor string, extra []model.ListFilter) ([]model.Record, string, error) {
	out, err := runInTxOp(a, reqCtx, headers, func(operationTransaction *model.OpTx) (listOut, model.Signal, *model.FailError, error) {
		items, next, signal, failError, opErr := listTx(stored, m, operation, operationTransaction, headers, cursor, extra)
		return listOut{items: items, next: next}, signal, failError, opErr
	})
	return out.items, out.next, err
}

func runResume[S any](application model.AppRef, stored *model.StoredModel, operation func(*model.Flow[S]) model.Signal, entityID model.ID) error {
	reqCtx := context.Background()
	headers := map[string]string{}
	_, failError, err := model.RunInTx(reqCtx, application.DB(), func(transaction pgx.Tx) (model.Signal, *model.FailError, error) {
		data, rerr := store.ReadTx(transaction, model.TableFor(stored), entityID.String())
		if rerr != nil {
			return model.Failed, nil, rerr
		}
		h := headersFromEntity(data, headers)
		operationTransaction := model.NewOpTx(reqCtx, transaction, application, h)
		signal, opFerr, opErr := resumeTx(stored, operation, operationTransaction, h, entityID)
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

func decodeRecord[S any](modelDefinition row.Map) model.Record {
	var s S
	serde.FromRow(modelDefinition, &s)
	return model.Record{
		ID:     model.ID(modelDefinition.RequireText("id")),
		Status: model.EntityStatus(modelDefinition.TextOr("_fookie_status", "")),
		Error:  modelDefinition.TextOr("_fookie_error", ""),
		Data:   &s,
	}
}

func stripInternal(data row.Map) {
	delete(data, "_fookie_status")
	delete(data, "_fookie_error")
	delete(data, "_fookie_headers")
}

const (
	colCreatedAt = "created_at"
	colUpdatedAt = "updated_at"
	colIsDeleted = "is_deleted"
)

func applyBaseOnCreate(data row.Map, now string) {
	data[colCreatedAt] = row.FromText(now)
	data[colUpdatedAt] = row.FromText(now)
	data[colIsDeleted] = row.FromTruth(false)
}

func touchUpdatedAt(data row.Map, now string) {
	data[colUpdatedAt] = row.FromText(now)
}

func headersFromEntity(data row.Map, fallback map[string]string) map[string]string {
	if c := data["_fookie_headers"]; c.Kind == row.KindText && len(c.Text) > 0 {
		h := map[string]string{}
		_ = json.Unmarshal([]byte(c.Text), &h)
		return h
	}
	out := map[string]string{}
	for k, v := range fallback {
		out[k] = v
	}
	return out
}

func mergeRowPatch(existing, patch row.Map) row.Map {
	out := cloneRowMap(existing)
	for k, v := range patch {
		if k == "id" || k == "_fookie_status" || k == "_fookie_error" || k == "_fookie_headers" || serde.IsProtectedBaseColumn(k) {
			continue
		}
		out[k] = v
	}
	return out
}

func cloneRowMap(m row.Map) row.Map {
	out := make(row.Map, len(m))
	for k, v := range m {
		out[k] = v
	}
	return out
}
