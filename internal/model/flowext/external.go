package flowext

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/fookiejs/fookie/internal/model/schemawire"
	"github.com/fookiejs/fookie/internal/observability"
	"github.com/fookiejs/fookie/internal/observability/telemetry"
	"github.com/fookiejs/fookie/internal/reliability/outbox"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const outboxSelectSQL = `SELECT status, COALESCE(output::text,''), COALESCE(error_msg,'') FROM fookie_outbox WHERE external_id=$1`

type ExternalContext interface {
	Header(key string) (string, bool)
	DBTx() pgx.Tx
	ModelName() string
	CurrentEntityID() string
	AppRef() AppRef
	TraceID() string
	ExecContext() context.Context
}

type externalErrorSetter interface {
	setExternalError(string)
}

func stashExternalError(flow ExternalContext, message string) {
	if s, ok := flow.(externalErrorSetter); ok {
		s.setExternalError(message)
	}
}

type outboxRow struct {
	found  bool
	status string
	output []byte
	errMsg string
}

func parseOutput[O any](data []byte) O {
	var out O
	if len(data) == 0 {
		return out
	}
	if err := json.Unmarshal(data, &out); err != nil {
		fail(fmt.Errorf("unmarshal_output: %w", err))
	}
	return out
}

func marshalInput[Input any](input Input) ([]byte, error) {
	data, err := json.Marshal(input)
	if err != nil {
		return nil, fmt.Errorf("marshal input: %w", err)
	}
	return data, nil
}

func (e External[Input, Output]) retryPolicy() outbox.RetryPolicy {
	return outbox.RetryPolicy{Attempts: e.Retry.Attempts, Backoff: e.Retry.Backoff, MaxDelaySec: e.Retry.MaxDelaySec}
}

func (e External[Input, Output]) Run(flow ExternalContext, input Input) (Output, schemawire.Signal) {
	if flow.CurrentEntityID() == "" {
		return e.requireList(flow, input)
	}
	return e.requireEntity(flow, input)
}

func (e External[Input, Output]) externalID(entityID string, inputJSON []byte) (string, error) {
	if entityID != "" {
		return outbox.ExternalID(entityID, e.Name, inputJSON)
	}
	return outbox.InputExternalID(e.Name, inputJSON)
}

func (e External[Input, Output]) requireEntity(flow ExternalContext, input Input) (Output, schemawire.Signal) {
	transaction := flow.DBTx()
	inputJSON, err := marshalInput(input)
	if err != nil {
		fail(fmt.Errorf("marshal_input: %w", err))
	}
	externalID, err := e.externalID(flow.CurrentEntityID(), inputJSON)
	if err != nil {
		fail(fmt.Errorf("external_id: %w", err))
	}

	entry, err := outbox.Lookup(transaction, externalID)
	if err != nil {
		fail(fmt.Errorf("outbox_lookup: %w", err))
	}

	if entry == nil {
		return e.dispatchEntity(flow, transaction, externalID, inputJSON)
	}
	if entry.Status == outbox.StatusCompleted {
		return e.returnEntity(flow, transaction, entry, externalID, inputJSON), schemawire.Done
	}
	if entry.Status == outbox.StatusFailed {
		return e.failEntity(flow, entry, externalID)
	}
	return e.waitEntity(flow, transaction, externalID)
}

func (e External[Input, Output]) dispatchEntity(flow ExternalContext, transaction pgx.Tx, externalID string, inputJSON []byte) (Output, schemawire.Signal) {
	if err := outbox.Insert(transaction, e.Name, externalID, inputJSON, e.retryPolicy()); err != nil {
		fail(fmt.Errorf("outbox_insert: %w", err))
	}
	if err := outbox.AddWaiter(transaction, externalID, flow.ModelName(), flow.CurrentEntityID()); err != nil {
		fail(fmt.Errorf("outbox_waiter: %w", err))
	}
	execCtx := telemetry.ExternalStarted(flow.ExecContext(), e.Name, flow.ModelName(), flow.CurrentEntityID(), map[string]string{observability.ExternalID: externalID})
	telemetry.FlowSuspended(execCtx, flow.ModelName(), flow.CurrentEntityID(), map[string]string{observability.ServiceKey: e.Name})
	e.logExternal("external.dispatch", flow, externalID)
	var zero Output
	return zero, schemawire.Running
}

func (e External[Input, Output]) returnEntity(flow ExternalContext, transaction pgx.Tx, entry *outbox.Entry, externalID string, inputJSON []byte) Output {
	out := parseOutput[Output](entry.Output)
	compensateName, found, _ := outbox.LookupCompensateName(transaction, flow.AppRef().CompensationLinks(), e.Name)
	if found {
		if err := outbox.RecordSagaStep(transaction, flow.CurrentEntityID(), flow.ModelName(), e.Name, compensateName, inputJSON, entry.Output); err != nil {
			fail(fmt.Errorf("saga_step_record: %w", err))
		}
		observability.Debug("saga.step_recorded",
			observability.ServiceKey, e.Name,
			observability.CompensateKey, compensateName,
			observability.ModelKey, flow.ModelName(),
			observability.EntityIDKey, flow.CurrentEntityID())
	}
	telemetry.ExternalCompleted(flow.ExecContext(), e.Name, flow.ModelName(), flow.CurrentEntityID(), map[string]string{observability.ExternalID: externalID})
	e.logExternal("external.completed", flow, externalID)
	return out
}

func (e External[Input, Output]) failEntity(flow ExternalContext, entry *outbox.Entry, externalID string) (Output, schemawire.Signal) {
	telemetry.ExternalFailed(flow.ExecContext(), e.Name, flow.ModelName(), flow.CurrentEntityID(), map[string]string{observability.ExternalID: externalID, observability.ReasonKey: entry.ErrorMsg})
	observability.Warn("external.failed",
		observability.ServiceKey, e.Name,
		observability.ModelKey, flow.ModelName(),
		observability.EntityIDKey, flow.CurrentEntityID(),
		observability.ExternalID, externalID,
		observability.ReasonKey, entry.ErrorMsg)
	stashExternalError(flow, entry.ErrorMsg)
	var zero Output
	return zero, schemawire.Failed
}

func (e External[Input, Output]) waitEntity(flow ExternalContext, transaction pgx.Tx, externalID string) (Output, schemawire.Signal) {
	if err := outbox.AddWaiter(transaction, externalID, flow.ModelName(), flow.CurrentEntityID()); err != nil {
		fail(fmt.Errorf("outbox_waiter: %w", err))
	}
	telemetry.ExternalPending(flow.ExecContext(), e.Name, flow.ModelName(), flow.CurrentEntityID(), map[string]string{observability.ExternalID: externalID})
	telemetry.FlowSuspended(flow.ExecContext(), flow.ModelName(), flow.CurrentEntityID(), map[string]string{observability.ServiceKey: e.Name})
	var zero Output
	return zero, schemawire.Running
}

func (e External[Input, Output]) logExternal(message string, flow ExternalContext, externalID string) {
	observability.Info(message,
		observability.ServiceKey, e.Name,
		observability.ModelKey, flow.ModelName(),
		observability.EntityIDKey, flow.CurrentEntityID(),
		observability.ExternalID, externalID)
}

func (e External[Input, Output]) requireList(flow ExternalContext, input Input) (Output, schemawire.Signal) {
	app := flow.AppRef()
	inputJSON, err := marshalInput(input)
	if err != nil {
		fail(fmt.Errorf("marshal_input: %w", err))
	}
	externalID, err := e.externalID("", inputJSON)
	if err != nil {
		fail(fmt.Errorf("external_id: %w", err))
	}

	bgCtx := context.Background()
	pool := app.DB().Pool
	row, err := readOutboxRow(bgCtx, pool, externalID)
	if err != nil {
		fail(fmt.Errorf("outbox_read: %w", err))
	}

	if !row.found {
		if err := outbox.InsertPool(bgCtx, pool, e.Name, externalID, inputJSON, e.retryPolicy()); err != nil {
			fail(fmt.Errorf("outbox_insert: %w", err))
		}
		observability.Info("external.dispatch", observability.ServiceKey, e.Name, observability.ExternalID, externalID)
	} else {
		switch row.status {
		case outbox.StatusCompleted:
			observability.Info("external.completed", observability.ServiceKey, e.Name, observability.ExternalID, externalID)
			return parseOutput[Output](row.output), schemawire.Done
		case outbox.StatusFailed:
			stashExternalError(flow, row.errMsg)
			var zero Output
			return zero, schemawire.Failed
		case outbox.StatusPending, outbox.StatusProcessing:
		}
	}

	output, err := pollOutbox(bgCtx, pool, externalID, 30*time.Second)
	if err != nil {
		stashExternalError(flow, err.Error())
		var zero Output
		return zero, schemawire.Failed
	}
	observability.Info("external.completed", observability.ServiceKey, e.Name, observability.ExternalID, externalID)
	return parseOutput[Output](output), schemawire.Done
}

func readOutboxRow(ctx context.Context, pool *pgxpool.Pool, externalID string) (outboxRow, error) {
	var status, output, errMsg string
	err := pool.QueryRow(ctx, outboxSelectSQL, externalID).Scan(&status, &output, &errMsg)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return outboxRow{}, nil
		}
		return outboxRow{}, fmt.Errorf("outbox row scan: %w", err)
	}
	return outboxRow{found: true, status: status, output: []byte(output), errMsg: errMsg}, nil
}

func pollOutbox(ctx context.Context, pool *pgxpool.Pool, externalID string, timeout time.Duration) ([]byte, error) {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		row, err := readOutboxRow(ctx, pool, externalID)
		if err != nil {
			return nil, err
		}
		if !row.found {
			time.Sleep(50 * time.Millisecond)
			continue
		}
		switch row.status {
		case outbox.StatusCompleted:
			return row.output, nil
		case outbox.StatusFailed:
			return nil, fmt.Errorf("%s", row.errMsg)
		case outbox.StatusPending, outbox.StatusProcessing:
		}
		time.Sleep(50 * time.Millisecond)
	}
	return nil, fmt.Errorf("external timeout after %s", timeout)
}

func compensateAll(transaction pgx.Tx, modelName, entityID string) error {
	steps, err := outbox.LoadSagaSteps(transaction, entityID, modelName)
	if err != nil {
		return err
	}
	start := time.Now()
	for _, step := range steps {
		compInput := step.CompensateInput()
		externalID, err := outbox.ExternalID(entityID, step.Compensate, compInput)
		if err != nil {
			return err
		}
		if err := outbox.Insert(transaction, step.Compensate, externalID, compInput, outbox.RetryPolicy{Attempts: 3}); err != nil {
			return err
		}
		if err := outbox.AddWaiter(transaction, externalID, modelName, entityID); err != nil {
			return err
		}
		observability.Debug("saga.compensation_dispatched",
			observability.ServiceKey, step.StepName,
			observability.CompensateKey, step.Compensate,
			observability.ModelKey, modelName,
			observability.EntityIDKey, entityID)
	}
	if err := outbox.ClearSagaSteps(transaction, entityID, modelName); err != nil {
		return err
	}
	observability.Info("saga.compensate_all_done",
		observability.ModelKey, modelName,
		observability.EntityIDKey, entityID,
		observability.StepCountKey, len(steps),
		observability.DurationMsKey, observability.MsElapsed(start))
	return nil
}

type ExternalHandlerFunc func(ctx context.Context, inputJSON []byte) ([]byte, error)

func WrapExternalHandler[Input, Output any](headers func(Input) (Output, error)) ExternalHandlerFunc {
	return func(_ context.Context, inputJSON []byte) ([]byte, error) {
		var in Input
		if err := json.Unmarshal(inputJSON, &in); err != nil {
			return nil, fmt.Errorf("unmarshal input: %w", err)
		}
		out, err := headers(in)
		if err != nil {
			return nil, err
		}
		return json.Marshal(out)
	}
}

func WrapCompensationHandler[FI, FO any](headers func(FI, FO) error) ExternalHandlerFunc {
	return func(_ context.Context, payloadJSON []byte) ([]byte, error) {
		var wrapper struct {
			Input  FI `json:"input"`
			Output FO `json:"output"`
		}
		if err := json.Unmarshal(payloadJSON, &wrapper); err != nil {
			return nil, fmt.Errorf("unmarshal compensation payload: %w", err)
		}
		if err := headers(wrapper.Input, wrapper.Output); err != nil {
			return nil, err
		}
		return nil, nil
	}
}
