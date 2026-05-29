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

func createTx[S any](stored *model.StoredModel, op func(*model.Flow[S]) model.Signal, otx *model.OpTx, headers map[string]string, bodyRow row.Map) (model.OpResult, model.Signal, *model.FailError, error) {
	if existing, err := store.FindExistingByUnique(otx.Ctx, otx.Tx, model.TableFor(stored), bodyRow); err != nil {
		return model.OpResult{}, model.Failed, nil, err
	} else if existing != nil {
		return resumeExisting[S](otx, stored, op, headers, existing)
	}

	entityID := model.NewID()
	var body S
	serde.FromRow(bodyRow, &body)
	execCtx := observability.FlowStarted(otx.Ctx, stored.Name, entityID.String())
	flow := model.NewEntityOpFlow(execCtx, otx.App, stored, entityID.String(), headers, body, otx, "")
	sig, ferr := model.RunOp(op, flow)
	if sig == model.Failed {
		_ = flow.CompensateAll()
		return model.OpResult{}, sig, ferr, nil
	}
	status := model.EntityStatusActive
	if sig == model.Running {
		status = model.EntityStatusPending
	} else if verr := model.ValidateBody(flow.Body); verr != nil {
		return model.OpResult{}, model.Failed, verr, nil
	}

	data := serde.ToRow(flow.Body)
	data["id"] = row.FromText(entityID.String())
	stripInternal(data)

	if _, err := store.InsertTx(otx.Tx, model.TableFor(stored), data); err != nil {
		if existing, lerr := store.FindExistingByUnique(otx.Ctx, otx.Tx, model.TableFor(stored), bodyRow); lerr == nil && existing != nil {
			return resumeExisting[S](otx, stored, op, headers, existing)
		}
		return model.OpResult{}, model.Failed, nil, err
	}
	if err := store.SetEntityStatusTx(otx.Tx, model.TableFor(stored), entityID.String(), status.String()); err != nil {
		return model.OpResult{}, model.Failed, nil, err
	}
	headersJSON, _ := json.Marshal(headers)
	if err := store.SetEntityHeadersTx(otx.Tx, model.TableFor(stored), entityID.String(), headersJSON); err != nil {
		return model.OpResult{}, model.Failed, nil, err
	}

	if sig == model.Running {
		observability.FlowSuspended(execCtx, stored.Name, entityID.String(), nil)
	} else {
		observability.FlowCompleted(execCtx, stored.Name, entityID.String())
	}
	return model.OpResult{ID: entityID, Pending: status == model.EntityStatusPending}, sig, nil, nil
}

func resumeExisting[S any](otx *model.OpTx, stored *model.StoredModel, op func(*model.Flow[S]) model.Signal, headers map[string]string, existing row.Map) (model.OpResult, model.Signal, *model.FailError, error) {
	entityID := model.ID(existing.RequireText("id"))
	status := model.EntityStatus(existing.TextOr("_fookie_status", ""))
	if status == model.EntityStatusActive {
		return model.OpResult{ID: entityID}, model.Done, nil, nil
	}
	h := headersFromEntity(existing, headers)
	sig, ferr, err := resumeEntityInTx[S](otx, stored, op, entityID, h, existing, status == model.EntityStatusFailed)
	if err != nil {
		return model.OpResult{}, model.Failed, ferr, err
	}
	if sig == model.Failed {
		return model.OpResult{}, sig, ferr, nil
	}
	return model.OpResult{ID: entityID, Pending: sig == model.Running}, sig, nil, nil
}

func resumeEntityInTx[S any](otx *model.OpTx, stored *model.StoredModel, op func(*model.Flow[S]) model.Signal, entityID model.ID, headers map[string]string, existing row.Map, resetFailed bool) (model.Signal, *model.FailError, error) {
	if resetFailed {
		if err := store.SetEntityStatusTx(otx.Tx, model.TableFor(stored), entityID.String(), model.EntityStatusPending.String()); err != nil {
			return model.Failed, nil, err
		}
	}
	data := cloneRowMap(existing)
	stripInternal(data)
	var body S
	serde.FromRow(data, &body)
	execCtx := observability.SchedulerResume(otx.Ctx, stored.Name, entityID.String())
	execCtx = observability.FlowResumed(execCtx, stored.Name, entityID.String())
	traceID := observability.TraceIDForEntity(entityID.String(), platform.NewUUIDv7)
	flow := model.NewEntityOpFlow(execCtx, otx.App, stored, entityID.String(), headers, body, otx, traceID)
	sig, ferr := model.RunOp(op, flow)
	if sig == model.Failed {
		_ = flow.CompensateAll()
		return sig, ferr, nil
	}
	status := model.EntityStatusActive
	if sig == model.Running {
		status = model.EntityStatusPending
	} else if verr := model.ValidateBody(flow.Body); verr != nil {
		return model.Failed, verr, nil
	}
	rowData := serde.ToRow(flow.Body)
	rowData["id"] = row.FromText(entityID.String())
	stripInternal(rowData)
	if _, err := store.UpdateTx(otx.Tx, model.TableFor(stored), entityID.String(), rowData); err != nil {
		return model.Failed, nil, err
	}
	if err := store.SetEntityStatusTx(otx.Tx, model.TableFor(stored), entityID.String(), status.String()); err != nil {
		return model.Failed, nil, err
	}
	if sig == model.Running {
		observability.FlowSuspended(execCtx, stored.Name, entityID.String(), nil)
	} else {
		observability.FlowCompleted(execCtx, stored.Name, entityID.String())
	}
	return sig, nil, nil
}

func readTx[S any](stored *model.StoredModel, op func(*model.Flow[S]) model.Signal, otx *model.OpTx, headers map[string]string, id model.ID) (model.Record, model.Signal, *model.FailError, error) {
	data, err := store.ReadTx(otx.Tx, model.TableFor(stored), id.String())
	if err != nil {
		return model.Record{}, model.Failed, nil, err
	}
	var body S
	serde.FromRow(data, &body)
	flow := model.NewBoundFlow(otx.Ctx, otx.App, stored, id.String(), headers, body, otx)
	sig, ferr := model.RunOp(op, flow)
	if sig == model.Failed {
		return model.Record{}, sig, ferr, nil
	}
	return model.Record{
		ID:     id,
		Status: model.EntityStatus(data["_fookie_status"].Text),
		Error:  data["_fookie_error"].Text,
		Data:   &flow.Body,
	}, sig, nil, nil
}

func updateTx[S any](stored *model.StoredModel, op func(*model.Flow[S]) model.Signal, otx *model.OpTx, headers map[string]string, id model.ID, bodyRow row.Map) (model.OpResult, model.Signal, *model.FailError, error) {
	existing, err := store.ReadTx(otx.Tx, model.TableFor(stored), id.String())
	if err != nil {
		return model.OpResult{}, model.Failed, nil, err
	}
	merged := mergeRowPatch(existing, bodyRow)
	var body S
	serde.FromRow(merged, &body)
	flow := model.NewBoundFlow(otx.Ctx, otx.App, stored, id.String(), headers, body, otx)
	sig, ferr := model.RunOp(op, flow)
	if sig == model.Failed {
		_ = flow.CompensateAll()
		return model.OpResult{}, sig, ferr, nil
	}
	data := serde.ToRow(flow.Body)
	delete(data, "id")
	stripInternal(data)
	if verr := model.ValidateBody(flow.Body); verr != nil {
		return model.OpResult{}, model.Failed, verr, nil
	}
	if _, err := store.UpdateTx(otx.Tx, model.TableFor(stored), id.String(), data); err != nil {
		return model.OpResult{}, model.Failed, nil, err
	}
	if sig == model.Running {
		if err := store.SetEntityStatusTx(otx.Tx, model.TableFor(stored), id.String(), model.EntityStatusPending.String()); err != nil {
			return model.OpResult{}, model.Failed, nil, err
		}
	}
	return model.OpResult{ID: id, Pending: sig == model.Running}, sig, nil, nil
}

func deleteTx[S any](stored *model.StoredModel, op func(*model.Flow[S]) model.Signal, otx *model.OpTx, headers map[string]string, id model.ID) (model.Signal, *model.FailError, error) {
	data, err := store.ReadTx(otx.Tx, model.TableFor(stored), id.String())
	if err != nil {
		return model.Failed, nil, err
	}
	var body S
	serde.FromRow(data, &body)
	flow := model.NewBoundFlow(otx.Ctx, otx.App, stored, id.String(), headers, body, otx)
	sig, ferr := model.RunOp(op, flow)
	if sig == model.Failed {
		return sig, ferr, nil
	}
	if err := store.DeleteTx(otx.Tx, model.TableFor(stored), id.String()); err != nil {
		return model.Failed, nil, err
	}
	return sig, nil, nil
}

func listTx[S any](stored *model.StoredModel, m *model.Model[S], op func(*model.ListFlow[S]) model.Signal, otx *model.OpTx, headers map[string]string, cursor string, extra []model.ListFilter) ([]model.Record, string, model.Signal, *model.FailError, error) {
	flow := model.NewListFlow(otx.Ctx, stored, m.Field)
	flow.Headers = headers
	flow.SetApp(otx.App)
	if sig, ferr := model.RunListOp(op, flow); sig == model.Failed {
		return nil, "", sig, ferr, nil
	}
	flow.ApplyExtraFilters(extra)
	flow.ApplyPagination(cursor, otx.App.ListLimit())
	items, next, err := flow.ListItemsTx(otx)
	if err != nil {
		return nil, "", model.Failed, nil, err
	}
	records := make([]model.Record, len(items))
	for i := range items {
		records[i] = decodeRecord[S](items[i])
	}
	return records, next, model.Done, nil, nil
}

func resumeTx[S any](stored *model.StoredModel, op func(*model.Flow[S]) model.Signal, otx *model.OpTx, headers map[string]string, entityID model.ID) (model.Signal, *model.FailError, error) {
	data, err := store.ReadTx(otx.Tx, model.TableFor(stored), entityID.String())
	if err != nil {
		return model.Failed, nil, err
	}
	h := headersFromEntity(data, headers)
	return resumeEntityInTx[S](otx, stored, op, entityID, h, data, false)
}

func runCreate[S any](a model.AppRef, stored *model.StoredModel, op func(*model.Flow[S]) model.Signal, reqCtx context.Context, headers map[string]string, bodyRow row.Map) (model.OpResult, error) {
	var result model.OpResult
	_, ferr, err := model.RunInTx(reqCtx, a.DB(), func(tx pgx.Tx) (model.Signal, *model.FailError, error) {
		otx := model.NewOpTx(reqCtx, tx, a, headers)
		out, sig, opFerr, opErr := createTx(stored, op, otx, headers, bodyRow)
		if opErr != nil {
			return model.Failed, opFerr, opErr
		}
		if sig == model.Failed {
			return model.Failed, opFerr, nil
		}
		result = out
		return sig, nil, nil
	})
	if err != nil {
		return model.OpResult{}, err
	}
	if ferr != nil {
		return model.OpResult{}, ferr
	}
	return result, nil
}

func runRead[S any](a model.AppRef, stored *model.StoredModel, op func(*model.Flow[S]) model.Signal, reqCtx context.Context, headers map[string]string, id model.ID) (model.Record, error) {
	var result model.Record
	_, ferr, err := model.RunInTx(reqCtx, a.DB(), func(tx pgx.Tx) (model.Signal, *model.FailError, error) {
		otx := model.NewOpTx(reqCtx, tx, a, headers)
		out, sig, opFerr, opErr := readTx(stored, op, otx, headers, id)
		if opErr != nil {
			return model.Failed, opFerr, opErr
		}
		if sig == model.Failed {
			return model.Failed, opFerr, nil
		}
		result = out
		return sig, nil, nil
	})
	if err != nil {
		return model.Record{}, err
	}
	if ferr != nil {
		return model.Record{}, ferr
	}
	return result, nil
}

func runUpdate[S any](a model.AppRef, stored *model.StoredModel, op func(*model.Flow[S]) model.Signal, reqCtx context.Context, headers map[string]string, id model.ID, bodyRow row.Map) (model.OpResult, error) {
	var result model.OpResult
	_, ferr, err := model.RunInTx(reqCtx, a.DB(), func(tx pgx.Tx) (model.Signal, *model.FailError, error) {
		otx := model.NewOpTx(reqCtx, tx, a, headers)
		out, sig, opFerr, opErr := updateTx(stored, op, otx, headers, id, bodyRow)
		if opErr != nil {
			return model.Failed, opFerr, opErr
		}
		if sig == model.Failed {
			return model.Failed, opFerr, nil
		}
		result = out
		return sig, nil, nil
	})
	if err != nil {
		return model.OpResult{}, err
	}
	if ferr != nil {
		return model.OpResult{}, ferr
	}
	return result, nil
}

func runDelete[S any](a model.AppRef, stored *model.StoredModel, op func(*model.Flow[S]) model.Signal, reqCtx context.Context, headers map[string]string, id model.ID) error {
	_, ferr, err := model.RunInTx(reqCtx, a.DB(), func(tx pgx.Tx) (model.Signal, *model.FailError, error) {
		otx := model.NewOpTx(reqCtx, tx, a, headers)
		sig, opFerr, opErr := deleteTx(stored, op, otx, headers, id)
		if opErr != nil {
			return model.Failed, opFerr, opErr
		}
		return sig, opFerr, nil
	})
	if err != nil {
		return err
	}
	return ferr
}

func runList[S any](a model.AppRef, stored *model.StoredModel, m *model.Model[S], op func(*model.ListFlow[S]) model.Signal, reqCtx context.Context, headers map[string]string, cursor string, extra []model.ListFilter) ([]model.Record, string, error) {
	var items []model.Record
	var next string
	_, ferr, err := model.RunInTx(reqCtx, a.DB(), func(tx pgx.Tx) (model.Signal, *model.FailError, error) {
		otx := model.NewOpTx(reqCtx, tx, a, headers)
		out, n, sig, opFerr, opErr := listTx(stored, m, op, otx, headers, cursor, extra)
		if opErr != nil {
			return model.Failed, opFerr, opErr
		}
		if sig == model.Failed {
			return model.Failed, opFerr, nil
		}
		items = out
		next = n
		return sig, nil, nil
	})
	if err != nil {
		return nil, "", err
	}
	if ferr != nil {
		return nil, "", ferr
	}
	return items, next, nil
}

func runResume[S any](a model.AppRef, stored *model.StoredModel, op func(*model.Flow[S]) model.Signal, entityID model.ID) error {
	reqCtx := context.Background()
	headers := map[string]string{}
	_, ferr, err := model.RunInTx(reqCtx, a.DB(), func(tx pgx.Tx) (model.Signal, *model.FailError, error) {
		data, rerr := store.ReadTx(tx, model.TableFor(stored), entityID.String())
		if rerr != nil {
			return model.Failed, nil, rerr
		}
		h := headersFromEntity(data, headers)
		otx := model.NewOpTx(reqCtx, tx, a, h)
		sig, opFerr, opErr := resumeTx(stored, op, otx, h, entityID)
		if opErr != nil {
			return model.Failed, opFerr, opErr
		}
		return sig, opFerr, nil
	})
	if err != nil {
		model.MarkEntityFailed(reqCtx, a, stored, entityID.String(), err.Error(), "")
		return err
	}
	if ferr != nil {
		model.MarkEntityFailed(reqCtx, a, stored, entityID.String(), ferr.Error(), "")
		return ferr
	}
	return nil
}

func decodeRecord[S any](m row.Map) model.Record {
	var s S
	serde.FromRow(m, &s)
	return model.Record{
		ID:     model.ID(m.RequireText("id")),
		Status: model.EntityStatus(m.TextOr("_fookie_status", "")),
		Error:  m.TextOr("_fookie_error", ""),
		Data:   &s,
	}
}

func stripInternal(data row.Map) {
	delete(data, "_fookie_status")
	delete(data, "_fookie_error")
	delete(data, "_fookie_headers")
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
		if k == "id" || k == "_fookie_status" || k == "_fookie_error" || k == "_fookie_headers" {
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
