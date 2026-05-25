package fookie

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	outboxStatusPending    = "pending"
	outboxStatusProcessing = "processing"
	outboxStatusCompleted  = "completed"
	outboxStatusFailed     = "failed"
)

type outboxEntry struct {
	ID          string
	Name        string
	CallKey     string
	Input       []byte
	Output      []byte
	Status      string
	Attempts    int
	MaxAttempts int
	NextRetry   *time.Time
	ErrorMsg    string
}

type outboxWaiter struct {
	OutboxID string
	Model    string
	EntityID string
}

func (d *db) migrateOutbox() error {
	ctx := context.Background()
	_, err := d.pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS fookie_outbox (
			id           TEXT PRIMARY KEY,
			name         TEXT NOT NULL,
			call_key     TEXT NOT NULL UNIQUE,
			input        JSONB NOT NULL,
			output       JSONB,
			status       TEXT NOT NULL DEFAULT 'pending',
			attempts     INT  NOT NULL DEFAULT 0,
			max_attempts INT  NOT NULL DEFAULT 3,
			next_retry   TIMESTAMPTZ,
			error_msg    TEXT,
			created_at   TIMESTAMPTZ DEFAULT NOW(),
			updated_at   TIMESTAMPTZ DEFAULT NOW()
		)`)
	if err != nil {
		return fmt.Errorf("outbox table: %w", err)
	}
	_, err = d.pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS fookie_outbox_waiter (
			outbox_id  TEXT NOT NULL,
			model      TEXT NOT NULL,
			entity_id  TEXT NOT NULL,
			PRIMARY KEY (outbox_id, model, entity_id)
		)`)
	if err != nil {
		return fmt.Errorf("outbox_waiter table: %w", err)
	}
	_, err = d.pool.Exec(ctx, `
		CREATE INDEX IF NOT EXISTS fookie_outbox_status_retry_idx
		ON fookie_outbox (status, next_retry)
		WHERE status = 'pending'`)
	if err != nil {
		return err
	}
	_, err = d.pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS fookie_saga_step (
			id          TEXT PRIMARY KEY,
			entity_id   TEXT NOT NULL,
			model       TEXT NOT NULL,
			step_name   TEXT NOT NULL,
			compensate  TEXT NOT NULL,
			input_json  JSONB NOT NULL,
			output_json JSONB,
			created_at  TIMESTAMPTZ DEFAULT NOW(),
			UNIQUE (entity_id, model, step_name)
		)`)
	if err != nil {
		return fmt.Errorf("saga_step table: %w", err)
	}
	_, _ = d.pool.Exec(ctx, `
		ALTER TABLE fookie_saga_step ADD COLUMN IF NOT EXISTS output_json JSONB`)
	_, err = d.pool.Exec(ctx, `
		CREATE INDEX IF NOT EXISTS fookie_saga_step_entity_idx
		ON fookie_saga_step (entity_id, model)`)
	if err != nil {
		return err
	}
	_, err = d.pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS fookie_compensation (
			service_name    TEXT PRIMARY KEY,
			compensate_name TEXT NOT NULL
		)`)
	if err != nil {
		return fmt.Errorf("compensation table: %w", err)
	}
	return nil
}

func outboxCallKey(entityID, serviceName string, inputJSON []byte) string {
	h := sha256.New()
	_, _ = h.Write([]byte(entityID))
	_, _ = h.Write([]byte(":"))
	_, _ = h.Write([]byte(serviceName))
	_, _ = h.Write([]byte(":"))
	_, _ = h.Write(inputJSON)
	return hex.EncodeToString(h.Sum(nil))
}

func outboxLookup(tx pgx.Tx, callKey string) (*outboxEntry, error) {
	row := tx.QueryRow(context.Background(),
		`SELECT id, name, call_key, input, output, status, attempts, max_attempts, next_retry, COALESCE(error_msg,'')
		 FROM fookie_outbox WHERE call_key = $1`, callKey)
	var e outboxEntry
	err := row.Scan(&e.ID, &e.Name, &e.CallKey, &e.Input, &e.Output,
		&e.Status, &e.Attempts, &e.MaxAttempts, &e.NextRetry, &e.ErrorMsg)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil //nolint:nilnil
		}
		return nil, err
	}
	return &e, nil
}

func outboxInsert(tx pgx.Tx, name, callKey string, inputJSON []byte, retry Retry) error {
	maxAttempts := retry.Attempts
	if maxAttempts <= 0 {
		maxAttempts = 3
	}
	_, err := tx.Exec(context.Background(),
		`INSERT INTO fookie_outbox (id, name, call_key, input, max_attempts, next_retry)
		 VALUES ($1, $2, $3, $4, $5, NOW())
		 ON CONFLICT (call_key) DO NOTHING`,
		newUUIDv7(), name, callKey, string(inputJSON), maxAttempts)
	return err
}

func outboxInsertPool(ctx context.Context, pool *pgxpool.Pool, name, callKey string, inputJSON []byte, retry Retry) error {
	maxAttempts := retry.Attempts
	if maxAttempts <= 0 {
		maxAttempts = 3
	}
	_, err := pool.Exec(ctx,
		`INSERT INTO fookie_outbox (id, name, call_key, input, max_attempts, next_retry)
		 VALUES ($1, $2, $3, $4, $5, NOW())
		 ON CONFLICT (call_key) DO NOTHING`,
		newUUIDv7(), name, callKey, string(inputJSON), maxAttempts)
	return err
}

func outboxAddWaiter(tx pgx.Tx, callKey, model, entityID string) error {
	_, err := tx.Exec(context.Background(),
		`INSERT INTO fookie_outbox_waiter (outbox_id, model, entity_id)
		 SELECT id, $2, $3 FROM fookie_outbox WHERE call_key = $1
		 ON CONFLICT DO NOTHING`,
		callKey, model, entityID)
	return err
}

func outboxComplete(ctx context.Context, pool *pgxpool.Pool, callKey string, outputJSON []byte) error {
	_, err := pool.Exec(ctx,
		`UPDATE fookie_outbox SET status='completed', output=$1, updated_at=NOW()
		 WHERE call_key=$2`,
		string(outputJSON), callKey)
	return err
}

func outboxFail(ctx context.Context, pool *pgxpool.Pool, callKey, reason string) error {
	_, err := pool.Exec(ctx,
		`UPDATE fookie_outbox
		 SET attempts = attempts + 1,
		     error_msg = $1,
		     status = CASE WHEN attempts + 1 >= max_attempts THEN 'failed' ELSE 'pending' END,
		     next_retry = NOW() + (INTERVAL '1 second' * LEAST(POWER(2, attempts)::int, max_attempts)),
		     updated_at = NOW()
		 WHERE call_key = $2`,
		reason, callKey)
	return err
}

func outboxClaimBatch(ctx context.Context, pool *pgxpool.Pool, batchSize int, names []string) ([]outboxEntry, error) {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var rows pgx.Rows
	if len(names) == 0 {
		rows, err = tx.Query(ctx, `
			SELECT id, name, call_key, input, max_attempts
			FROM fookie_outbox
			WHERE status = 'pending' AND next_retry <= NOW()
			ORDER BY next_retry
			LIMIT $1
			FOR UPDATE SKIP LOCKED`,
			batchSize)
	} else {
		rows, err = tx.Query(ctx, `
			SELECT id, name, call_key, input, max_attempts
			FROM fookie_outbox
			WHERE status = 'pending' AND next_retry <= NOW() AND name = ANY($2)
			ORDER BY next_retry
			LIMIT $1
			FOR UPDATE SKIP LOCKED`,
			batchSize, names)
	}
	if err != nil {
		return nil, err
	}

	var entries []outboxEntry
	for rows.Next() {
		var e outboxEntry
		if err := rows.Scan(&e.ID, &e.Name, &e.CallKey, &e.Input, &e.MaxAttempts); err != nil {
			rows.Close()
			return nil, err
		}
		entries = append(entries, e)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}

	for _, e := range entries {
		if _, err := tx.Exec(ctx,
			`UPDATE fookie_outbox SET status='processing', updated_at=NOW() WHERE call_key=$1`,
			e.CallKey); err != nil {
			return nil, err
		}
	}
	return entries, tx.Commit(ctx)
}

func outboxWaiters(ctx context.Context, pool *pgxpool.Pool, callKey string) ([]outboxWaiter, error) {
	rows, err := pool.Query(ctx,
		`SELECT w.outbox_id, w.model, w.entity_id
		 FROM fookie_outbox_waiter w
		 JOIN fookie_outbox o ON o.id = w.outbox_id
		 WHERE o.call_key = $1`,
		callKey)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var waiters []outboxWaiter
	for rows.Next() {
		var w outboxWaiter
		if err := rows.Scan(&w.OutboxID, &w.Model, &w.EntityID); err != nil {
			return nil, err
		}
		waiters = append(waiters, w)
	}
	return waiters, rows.Err()
}

func marshalInput(v any) ([]byte, error) {
	return json.Marshal(resolveInput(v))
}

type sagaStep struct {
	StepName   string
	Compensate string
	InputJSON  []byte
	OutputJSON []byte
}

// compensateInput returns the JSON payload sent to the compensation handler.
// The payload is {"input":<forward-input>,"output":<forward-output>} so the
// handler has full context: both what was requested and what was returned.
func (s sagaStep) compensateInput() []byte {
	in := s.InputJSON
	if len(in) == 0 {
		in = []byte("null")
	}
	out := s.OutputJSON
	if len(out) == 0 {
		out = []byte("null")
	}
	buf := make([]byte, 0, len(in)+len(out)+20)
	buf = append(buf, `{"input":`...)
	buf = append(buf, in...)
	buf = append(buf, `,"output":`...)
	buf = append(buf, out...)
	buf = append(buf, '}')
	return buf
}

func sagaRecordStep(tx pgx.Tx, entityID, model, stepName, compensate string, inputJSON, outputJSON []byte) error {
	_, err := tx.Exec(context.Background(),
		`INSERT INTO fookie_saga_step (id, entity_id, model, step_name, compensate, input_json, output_json)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)
		 ON CONFLICT (entity_id, model, step_name) DO NOTHING`,
		newUUIDv7(), entityID, model, stepName, compensate, string(inputJSON), string(outputJSON))
	return err
}

func sagaLoadSteps(tx pgx.Tx, entityID, model string) ([]sagaStep, error) {
	rows, err := tx.Query(context.Background(),
		`SELECT step_name, compensate, input_json, COALESCE(output_json, 'null'::jsonb)
		 FROM fookie_saga_step
		 WHERE entity_id = $1 AND model = $2
		 ORDER BY created_at DESC`,
		entityID, model)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var steps []sagaStep
	for rows.Next() {
		var s sagaStep
		var rawOut []byte
		if err := rows.Scan(&s.StepName, &s.Compensate, &s.InputJSON, &rawOut); err != nil {
			return nil, err
		}
		if string(rawOut) != "null" {
			s.OutputJSON = rawOut
		}
		steps = append(steps, s)
	}
	return steps, rows.Err()
}

func sagaClearSteps(tx pgx.Tx, entityID, model string) error {
	_, err := tx.Exec(context.Background(),
		`DELETE FROM fookie_saga_step WHERE entity_id = $1 AND model = $2`,
		entityID, model)
	return err
}

func outboxDeleteWaiters(ctx context.Context, pool *pgxpool.Pool, callKey string) error {
	_, err := pool.Exec(ctx,
		`DELETE FROM fookie_outbox_waiter
		 WHERE outbox_id = (SELECT id FROM fookie_outbox WHERE call_key = $1)`,
		callKey)
	return err
}

type completedWaiter struct {
	CallKey  string
	Model    string
	EntityID string
}

func outboxCompletedWaiterRows(ctx context.Context, pool *pgxpool.Pool) ([]completedWaiter, error) {
	rows, err := pool.Query(ctx,
		`SELECT o.call_key, w.model, w.entity_id
		 FROM fookie_outbox_waiter w
		 JOIN fookie_outbox o ON o.id = w.outbox_id
		 WHERE o.status = 'completed'`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var result []completedWaiter
	for rows.Next() {
		var cw completedWaiter
		if err := rows.Scan(&cw.CallKey, &cw.Model, &cw.EntityID); err != nil {
			return nil, err
		}
		result = append(result, cw)
	}
	return result, rows.Err()
}

func lookupCompensateName(tx pgx.Tx, app *App, serviceName string) (string, bool, error) {
	if app != nil {
		if name, ok := app.compensationLinks[serviceName]; ok {
			return name, true, nil
		}
	}
	var name string
	err := tx.QueryRow(context.Background(),
		`SELECT compensate_name FROM fookie_compensation WHERE service_name = $1`,
		serviceName).Scan(&name)
	if err == pgx.ErrNoRows {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}
	return name, true, nil
}
