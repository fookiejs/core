package runtime

import (
	"context"
	"encoding/json"

	"github.com/fookiejs/fookie/internal/model/flowext"
	"github.com/fookiejs/fookie/internal/model/schemawire"
	"github.com/fookiejs/fookie/internal/observability"
	"github.com/fookiejs/fookie/internal/observability/telemetry"
	"github.com/fookiejs/fookie/internal/persistence/row"
	"github.com/fookiejs/fookie/internal/persistence/serde"
	"github.com/fookiejs/fookie/internal/persistence/store"
	"github.com/fookiejs/fookie/internal/platform"
	"github.com/jackc/pgx/v5"
)

func createTx[Schema any](stored *schemawire.StoredModel, operation func(*flowext.Flow[Schema]) schemawire.Signal, operationTransaction *flowext.OpTx, headers map[string]string, bodyRow row.Values) (schemawire.OpResult, schemawire.Signal, *schemawire.FailError, error) {
	if existing, err := store.FindExistingByUnique(operationTransaction.Ctx, operationTransaction.Tx, schemawire.TableFor(stored), bodyRow); err != nil {
		return schemawire.OpResult{}, schemawire.Failed, nil, err
	} else if existing != nil {
		return resumeExisting[Schema](operationTransaction, stored, operation, headers, existing)
	}

	entityID := schemawire.NewID()
	var body Schema
	serde.IntoStruct(bodyRow, &body)
	execCtx := telemetry.FlowStarted(operationTransaction.Ctx, stored.Name, entityID.String())
	flow := flowext.NewEntityOpFlow(execCtx, operationTransaction.App, stored, entityID.String(), headers, body, operationTransaction, "")
	signal, failError := flowext.RunOp(operation, flow)
	if signal == schemawire.Failed {
		_ = flow.CompensateAll()
		return schemawire.OpResult{}, signal, failError, nil
	}
	status, failError := entityStatusAfterOp(signal, flow.Body)
	if failError != nil {
		return schemawire.OpResult{}, schemawire.Failed, failError, nil
	}

	data := serde.Values(flow.Body)
	data = data.Upsert("id", row.FromText(entityID.String()))
	data = applyBaseOnCreate(data, platform.NowRFC3339())

	if _, err := store.InsertTx(operationTransaction.Tx, schemawire.TableFor(stored), data); err != nil {
		if existing, lerr := store.FindExistingByUnique(operationTransaction.Ctx, operationTransaction.Tx, schemawire.TableFor(stored), bodyRow); lerr == nil && existing != nil {
			return resumeExisting[Schema](operationTransaction, stored, operation, headers, existing)
		}
		return schemawire.OpResult{}, schemawire.Failed, nil, err
	}
	if err := store.SetEntityStatusTx(operationTransaction.Tx, schemawire.TableFor(stored), entityID.String(), status.String()); err != nil {
		return schemawire.OpResult{}, schemawire.Failed, nil, err
	}
	headersJSON, _ := json.Marshal(headers)
	if err := store.SetEntityHeadersTx(operationTransaction.Tx, schemawire.TableFor(stored), entityID.String(), headersJSON); err != nil {
		return schemawire.OpResult{}, schemawire.Failed, nil, err
	}

	observeFlowEnd(execCtx, stored.Name, entityID.String(), signal)
	return schemawire.OpResult{ID: entityID, Pending: status == schemawire.EntityStatusPending}, signal, nil, nil
}

func resumeExisting[Schema any](operationTransaction *flowext.OpTx, stored *schemawire.StoredModel, operation func(*flowext.Flow[Schema]) schemawire.Signal, headers map[string]string, existing row.Values) (schemawire.OpResult, schemawire.Signal, *schemawire.FailError, error) {
	entityID := schemawire.ID(existing.RequireText("id"))
	status := schemawire.EntityStatus(existing.TextOr("_fookie_status", ""))
	if status == schemawire.EntityStatusActive {
		return schemawire.OpResult{ID: entityID}, schemawire.Done, nil, nil
	}
	resolvedHeaders := headersFromEntity(existing, headers)
	signal, failError, err := resumeEntityInTx[Schema](operationTransaction, stored, operation, entityID, resolvedHeaders, existing, status == schemawire.EntityStatusFailed)
	if err != nil {
		return schemawire.OpResult{}, schemawire.Failed, failError, err
	}
	if signal == schemawire.Failed {
		return schemawire.OpResult{}, signal, failError, nil
	}
	return schemawire.OpResult{ID: entityID, Pending: signal == schemawire.Running}, signal, nil, nil
}

func resumeEntityInTx[Schema any](operationTransaction *flowext.OpTx, stored *schemawire.StoredModel, operation func(*flowext.Flow[Schema]) schemawire.Signal, entityID schemawire.ID, headers map[string]string, existing row.Values, resetFailed bool) (schemawire.Signal, *schemawire.FailError, error) {
	if resetFailed {
		if err := store.SetEntityStatusTx(operationTransaction.Tx, schemawire.TableFor(stored), entityID.String(), schemawire.EntityStatusPending.String()); err != nil {
			return schemawire.Failed, nil, err
		}
	}
	var body Schema
	serde.IntoStruct(existing, &body)
	execCtx := telemetry.SchedulerResume(operationTransaction.Ctx, stored.Name, entityID.String())
	execCtx = telemetry.FlowResumed(execCtx, stored.Name, entityID.String())
	traceID := observability.TraceIDForEntity(entityID.String(), platform.NewUUIDv7)
	flow := flowext.NewEntityOpFlow(execCtx, operationTransaction.App, stored, entityID.String(), headers, body, operationTransaction, traceID)
	signal, failError := flowext.RunOp(operation, flow)
	if signal == schemawire.Failed {
		_ = flow.CompensateAll()
		return signal, failError, nil
	}
	status, failError := entityStatusAfterOp(signal, flow.Body)
	if failError != nil {
		return schemawire.Failed, failError, nil
	}
	data := serde.Values(flow.Body)
	data = data.Upsert("id", row.FromText(entityID.String()))
	data = touchUpdatedAt(data, platform.NowRFC3339())
	if _, err := store.UpdateTx(operationTransaction.Tx, schemawire.TableFor(stored), entityID.String(), data); err != nil {
		return schemawire.Failed, nil, err
	}
	if err := store.SetEntityStatusTx(operationTransaction.Tx, schemawire.TableFor(stored), entityID.String(), status.String()); err != nil {
		return schemawire.Failed, nil, err
	}
	observeFlowEnd(execCtx, stored.Name, entityID.String(), signal)
	return signal, nil, nil
}

func readTx[Schema any](stored *schemawire.StoredModel, operation func(*flowext.Flow[Schema]) schemawire.Signal, operationTransaction *flowext.OpTx, headers map[string]string, identifier schemawire.ID) (schemawire.Record, schemawire.Signal, *schemawire.FailError, error) {
	data, err := store.ReadTx(operationTransaction.Tx, schemawire.TableFor(stored), identifier.String())
	if err != nil {
		return schemawire.Record{}, schemawire.Failed, nil, err
	}
	var body Schema
	serde.IntoStruct(data, &body)
	flow := flowext.NewBoundFlow(operationTransaction.Ctx, operationTransaction.App, stored, identifier.String(), headers, body, operationTransaction)
	signal, failError := flowext.RunOp(operation, flow)
	if signal == schemawire.Failed {
		return schemawire.Record{}, signal, failError, nil
	}
	return schemawire.Record{
		ID:     identifier,
		Status: schemawire.EntityStatus(data.TextOr("_fookie_status", "")),
		Error:  data.TextOr("_fookie_error", ""),
		Data:   &flow.Body,
	}, signal, nil, nil
}

func updateTx[Schema any](stored *schemawire.StoredModel, operation func(*flowext.Flow[Schema]) schemawire.Signal, operationTransaction *flowext.OpTx, headers map[string]string, identifier schemawire.ID, bodyRow row.Values) (schemawire.OpResult, schemawire.Signal, *schemawire.FailError, error) {
	existing, err := store.ReadTx(operationTransaction.Tx, schemawire.TableFor(stored), identifier.String())
	if err != nil {
		return schemawire.OpResult{}, schemawire.Failed, nil, err
	}
	merged := mergeRowPatch(existing, bodyRow)
	var body Schema
	serde.IntoStruct(merged, &body)
	flow := flowext.NewBoundFlow(operationTransaction.Ctx, operationTransaction.App, stored, identifier.String(), headers, body, operationTransaction)
	signal, failError := flowext.RunOp(operation, flow)
	if signal == schemawire.Failed {
		_ = flow.CompensateAll()
		return schemawire.OpResult{}, signal, failError, nil
	}
	data := serde.Values(flow.Body)
	data = data.Remove("id")
	if verr := schemawire.ValidateBody(flow.Body); verr != nil {
		return schemawire.OpResult{}, schemawire.Failed, verr, nil
	}
	data = touchUpdatedAt(data, platform.NowRFC3339())
	if _, err := store.UpdateTx(operationTransaction.Tx, schemawire.TableFor(stored), identifier.String(), data); err != nil {
		return schemawire.OpResult{}, schemawire.Failed, nil, err
	}
	if signal == schemawire.Running {
		if err := store.SetEntityStatusTx(operationTransaction.Tx, schemawire.TableFor(stored), identifier.String(), schemawire.EntityStatusPending.String()); err != nil {
			return schemawire.OpResult{}, schemawire.Failed, nil, err
		}
	}
	return schemawire.OpResult{ID: identifier, Pending: signal == schemawire.Running}, signal, nil, nil
}

func deleteTx[Schema any](stored *schemawire.StoredModel, operation func(*flowext.Flow[Schema]) schemawire.Signal, operationTransaction *flowext.OpTx, headers map[string]string, identifier schemawire.ID) (schemawire.Signal, *schemawire.FailError, error) {
	data, err := store.ReadTx(operationTransaction.Tx, schemawire.TableFor(stored), identifier.String())
	if err != nil {
		return schemawire.Failed, nil, err
	}
	var body Schema
	serde.IntoStruct(data, &body)
	flow := flowext.NewBoundFlow(operationTransaction.Ctx, operationTransaction.App, stored, identifier.String(), headers, body, operationTransaction)
	signal, failError := flowext.RunOp(operation, flow)
	if signal == schemawire.Failed {
		return signal, failError, nil
	}
	if err := store.DeleteTx(operationTransaction.Tx, schemawire.TableFor(stored), identifier.String(), platform.NowRFC3339()); err != nil {
		return schemawire.Failed, nil, err
	}
	return signal, nil, nil
}

func listTx[Schema any](stored *schemawire.StoredModel, modelDefinition *flowext.Model[Schema], operation func(*flowext.ListFlow[Schema]) schemawire.Signal, operationTransaction *flowext.OpTx, headers map[string]string, cursor string, extra []schemawire.ListFilter) ([]schemawire.Record, string, schemawire.Signal, *schemawire.FailError, error) {
	flow := flowext.NewListFlow(operationTransaction.Ctx, stored, modelDefinition.Field)
	flow.Headers = headers
	flow.SetApp(operationTransaction.App)
	if signal, failError := flowext.RunListOp(operation, flow); signal == schemawire.Failed {
		return nil, "", signal, failError, nil
	}
	flow.ApplyExtraFilters(extra)
	flow.ApplyPagination(cursor, operationTransaction.App.ListLimit())
	items, next, err := flow.ListItemsTx(operationTransaction)
	if err != nil {
		return nil, "", schemawire.Failed, nil, err
	}
	records := make([]schemawire.Record, len(items))
	for index := range items {
		records[index] = decodeRecord[Schema](items[index])
	}
	return records, next, schemawire.Done, nil, nil
}

func resumeTx[Schema any](stored *schemawire.StoredModel, operation func(*flowext.Flow[Schema]) schemawire.Signal, operationTransaction *flowext.OpTx, headers map[string]string, entityID schemawire.ID) (schemawire.Signal, *schemawire.FailError, error) {
	data, err := store.ReadTx(operationTransaction.Tx, schemawire.TableFor(stored), entityID.String())
	if err != nil {
		return schemawire.Failed, nil, err
	}
	resolvedHeaders := headersFromEntity(data, headers)
	return resumeEntityInTx[Schema](operationTransaction, stored, operation, entityID, resolvedHeaders, data, false)
}

func runInTxOp[Result any](application flowext.AppRef, reqCtx context.Context, headers map[string]string, callback func(*flowext.OpTx) (Result, schemawire.Signal, *schemawire.FailError, error)) (Result, error) {
	var result Result
	_, failError, err := flowext.RunInTx(reqCtx, application.DB(), func(transaction pgx.Tx) (schemawire.Signal, *schemawire.FailError, error) {
		operationTransaction := flowext.NewOpTx(reqCtx, transaction, application, headers)
		out, signal, opFerr, opErr := callback(operationTransaction)
		if opErr != nil {
			return schemawire.Failed, opFerr, opErr
		}
		if signal == schemawire.Failed {
			return schemawire.Failed, opFerr, nil
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
	items []schemawire.Record
	next  string
}

func runResume[Schema any](application flowext.AppRef, stored *schemawire.StoredModel, operation func(*flowext.Flow[Schema]) schemawire.Signal, entityID schemawire.ID) error {
	reqCtx := context.Background()
	headers := map[string]string{}
	_, failError, err := flowext.RunInTx(reqCtx, application.DB(), func(transaction pgx.Tx) (schemawire.Signal, *schemawire.FailError, error) {
		operationTransaction := flowext.NewOpTx(reqCtx, transaction, application, headers)
		return resumeTx(stored, operation, operationTransaction, headers, entityID)
	})
	if err != nil {
		flowext.MarkEntityFailed(reqCtx, application, stored, entityID.String(), err.Error(), "")
		return err
	}
	if failError != nil {
		flowext.MarkEntityFailed(reqCtx, application, stored, entityID.String(), failError.Error(), "")
		return failError
	}
	return nil
}

func decodeRecord[Schema any](data row.Values) schemawire.Record {
	var schemaValue Schema
	serde.IntoStruct(data, &schemaValue)
	return schemawire.Record{
		ID:     schemawire.ID(data.RequireText("id")),
		Status: schemawire.EntityStatus(data.TextOr("_fookie_status", "")),
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

func entityStatusAfterOp[Schema any](signal schemawire.Signal, body Schema) (schemawire.EntityStatus, *schemawire.FailError) {
	if signal == schemawire.Running {
		return schemawire.EntityStatusPending, nil
	}
	if failError := schemawire.ValidateBody(body); failError != nil {
		return "", failError
	}
	return schemawire.EntityStatusActive, nil
}

func observeFlowEnd(execCtx context.Context, modelName, entityID string, signal schemawire.Signal) {
	if signal == schemawire.Running {
		telemetry.FlowSuspended(execCtx, modelName, entityID, nil)
		return
	}
	telemetry.FlowCompleted(execCtx, modelName, entityID)
}
