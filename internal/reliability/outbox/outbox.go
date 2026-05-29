package outbox

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"
	"time"

	"github.com/fookiejs/fookie/internal/persistence/row"
	"github.com/fookiejs/fookie/internal/platform"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	StatusPending    = "pending"
	StatusProcessing = "processing"
	StatusCompleted  = "completed"
	StatusFailed     = "failed"
)

type Entry struct {
	ID          string
	Name        string
	ExternalID     string
	Input       []byte
	Output      []byte
	Status      string
	Attempts    int
	MaxAttempts int
	NextRetry   *time.Time
	ErrorMsg    string
}

type Waiter struct {
	OutboxID string
	Model    string
	EntityID string
}

type CompletedWaiter struct {
	ExternalID  string
	Model    string
	EntityID string
}

func Migrate(pool *pgxpool.Pool) error {
	ctx := context.Background()
	_, err := pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS fookie_outbox (
			id            TEXT PRIMARY KEY,
			name          TEXT NOT NULL,
			external_id      TEXT NOT NULL UNIQUE,
			input         JSONB NOT NULL,
			output        JSONB,
			status        TEXT NOT NULL DEFAULT 'pending',
			attempts      INT  NOT NULL DEFAULT 0,
			max_attempts  INT  NOT NULL DEFAULT 3,
			backoff       TEXT NOT NULL DEFAULT 'exponential',
			max_delay_sec INT  NOT NULL DEFAULT 60,
			next_retry    TIMESTAMPTZ,
			error_msg     TEXT,
			created_at    TIMESTAMPTZ DEFAULT NOW(),
			updated_at    TIMESTAMPTZ DEFAULT NOW()
		)`)
	if err != nil {
		return fmt.Errorf("outbox table: %w", err)
	}
	for _, alter := range []string{
		`ALTER TABLE fookie_outbox ADD COLUMN IF NOT EXISTS backoff TEXT NOT NULL DEFAULT 'exponential'`,
		`ALTER TABLE fookie_outbox ADD COLUMN IF NOT EXISTS max_delay_sec INT NOT NULL DEFAULT 60`,
	} {
		if _, err := pool.Exec(ctx, alter); err != nil {
			return fmt.Errorf("outbox alter: %w", err)
		}
	}
	_, err = pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS fookie_outbox_waiter (
			outbox_id  TEXT NOT NULL,
			model      TEXT NOT NULL,
			entity_id  TEXT NOT NULL,
			PRIMARY KEY (outbox_id, model, entity_id)
		)`)
	if err != nil {
		return fmt.Errorf("outbox_waiter table: %w", err)
	}
	_, err = pool.Exec(ctx, `
		CREATE INDEX IF NOT EXISTS fookie_outbox_status_retry_idx
		ON fookie_outbox (status, next_retry)
		WHERE status = 'pending'`)
	if err != nil {
		return err
	}
	_, err = pool.Exec(ctx, `
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
	_, _ = pool.Exec(ctx, `
		ALTER TABLE fookie_saga_step ADD COLUMN IF NOT EXISTS output_json JSONB`)
	_, err = pool.Exec(ctx, `
		CREATE INDEX IF NOT EXISTS fookie_saga_step_entity_idx
		ON fookie_saga_step (entity_id, model)`)
	if err != nil {
		return err
	}
	_, err = pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS fookie_compensation (
			service_name    TEXT PRIMARY KEY,
			compensate_name TEXT NOT NULL
		)`)
	if err != nil {
		return fmt.Errorf("compensation table: %w", err)
	}
	return nil
}

func BusinessReferenceFromInput(inputJSON []byte) (string, bool, error) {
	raw, err := row.UnmarshalJSON(inputJSON)
	if err != nil {
		return "", false, fmt.Errorf("BusinessReferenceFromInput: %w", err)
	}
	cell, exists := raw["reference"]
	if !exists || cell.Kind != row.KindText {
		return "", false, nil
	}
	ref := strings.TrimSpace(cell.Text)
	if ref == "" {
		return "", false, nil
	}
	return ref, true, nil
}

func ExternalID(entityID, serviceName string, inputJSON []byte) (string, error) {
	ref, hasRef, err := BusinessReferenceFromInput(inputJSON)
	if err != nil {
		return "", err
	}
	if hasRef {
		h := sha256.New()
		_, _ = h.Write([]byte(serviceName))
		_, _ = h.Write([]byte(":"))
		_, _ = h.Write([]byte(ref))
		return hex.EncodeToString(h.Sum(nil)), nil
	}
	h := sha256.New()
	_, _ = h.Write([]byte(entityID))
	_, _ = h.Write([]byte(":"))
	_, _ = h.Write([]byte(serviceName))
	_, _ = h.Write([]byte(":"))
	_, _ = h.Write(inputJSON)
	return hex.EncodeToString(h.Sum(nil)), nil
}

func BusinessExternalID(serviceName, businessKey string) string {
	h := sha256.New()
	_, _ = h.Write([]byte("biz:"))
	_, _ = h.Write([]byte(serviceName))
	_, _ = h.Write([]byte(":"))
	_, _ = h.Write([]byte(businessKey))
	return hex.EncodeToString(h.Sum(nil))
}

func Lookup(tx pgx.Tx, externalID string) (*Entry, error) {
	row := tx.QueryRow(context.Background(),
		`SELECT id, name, external_id, input, output, status, attempts, max_attempts, next_retry, COALESCE(error_msg,'')
		 FROM fookie_outbox WHERE external_id = $1`, externalID)
	var e Entry
	err := row.Scan(&e.ID, &e.Name, &e.ExternalID, &e.Input, &e.Output,
		&e.Status, &e.Attempts, &e.MaxAttempts, &e.NextRetry, &e.ErrorMsg)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &e, nil
}

type RetryPolicy struct {
	Attempts    int
	Backoff     string
	MaxDelaySec int
}

func (p RetryPolicy) normalize() (attempts int, backoff string, maxDelaySec int) {
	attempts = p.Attempts
	if attempts <= 0 {
		attempts = 3
	}
	backoff = p.Backoff
	if backoff != "linear" {
		backoff = "exponential"
	}
	maxDelaySec = p.MaxDelaySec
	if maxDelaySec <= 0 {
		maxDelaySec = 60
	}
	return attempts, backoff, maxDelaySec
}

func Insert(tx pgx.Tx, name, externalID string, inputJSON []byte, retry RetryPolicy) error {
	attempts, backoff, maxDelaySec := retry.normalize()
	_, err := tx.Exec(context.Background(),
		`INSERT INTO fookie_outbox (id, name, external_id, input, max_attempts, backoff, max_delay_sec, next_retry)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
		 ON CONFLICT (external_id) DO NOTHING`,
		platform.NewUUIDv7(), name, externalID, string(inputJSON), attempts, backoff, maxDelaySec)
	return err
}

func InsertPool(ctx context.Context, pool *pgxpool.Pool, name, externalID string, inputJSON []byte, retry RetryPolicy) error {
	attempts, backoff, maxDelaySec := retry.normalize()
	_, err := pool.Exec(ctx,
		`INSERT INTO fookie_outbox (id, name, external_id, input, max_attempts, backoff, max_delay_sec, next_retry)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
		 ON CONFLICT (external_id) DO NOTHING`,
		platform.NewUUIDv7(), name, externalID, string(inputJSON), attempts, backoff, maxDelaySec)
	return err
}

func AddWaiter(tx pgx.Tx, externalID, model, entityID string) error {
	_, err := tx.Exec(context.Background(),
		`INSERT INTO fookie_outbox_waiter (outbox_id, model, entity_id)
		 SELECT id, $2, $3 FROM fookie_outbox WHERE external_id = $1
		 ON CONFLICT DO NOTHING`,
		externalID, model, entityID)
	return err
}

func IsTerminalFailed(ctx context.Context, pool *pgxpool.Pool, externalID string) (bool, error) {
	var status string
	err := pool.QueryRow(ctx, `SELECT status FROM fookie_outbox WHERE external_id=$1`, externalID).Scan(&status)
	if err != nil {
		if err == pgx.ErrNoRows {
			return false, nil
		}
		return false, err
	}
	return status == StatusFailed, nil
}

func Complete(ctx context.Context, pool *pgxpool.Pool, externalID string, outputJSON []byte) error {
	var output any
	if len(outputJSON) > 0 {
		output = string(outputJSON)
	}
	_, err := pool.Exec(ctx,
		`UPDATE fookie_outbox SET status='completed', output=$1, updated_at=NOW()
		 WHERE external_id=$2`,
		output, externalID)
	return err
}

func Fail(ctx context.Context, pool *pgxpool.Pool, externalID, reason string) error {
	_, err := pool.Exec(ctx,
		`UPDATE fookie_outbox
		 SET attempts = attempts + 1,
		     error_msg = $1,
		     status = CASE WHEN attempts + 1 >= max_attempts THEN 'failed' ELSE 'pending' END,
		     next_retry = NOW() + (INTERVAL '1 second' * CASE backoff
		         WHEN 'linear' THEN LEAST(attempts + 1, max_delay_sec)
		         ELSE LEAST(POWER(2, attempts)::int, max_delay_sec)
		     END),
		     updated_at = NOW()
		 WHERE external_id = $2`,
		reason, externalID)
	return err
}

func ClaimBatch(ctx context.Context, pool *pgxpool.Pool, batchSize int, names []string) ([]Entry, error) {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var rows pgx.Rows
	if len(names) == 0 {
		rows, err = tx.Query(ctx, `
			SELECT id, name, external_id, input, max_attempts
			FROM fookie_outbox
			WHERE (status = 'pending' AND next_retry <= NOW())
			   OR (status = 'processing' AND updated_at < NOW() - INTERVAL '60 seconds')
			ORDER BY next_retry
			LIMIT $1
			FOR UPDATE SKIP LOCKED`,
			batchSize)
	} else {
		rows, err = tx.Query(ctx, `
			SELECT id, name, external_id, input, max_attempts
			FROM fookie_outbox
			WHERE name = ANY($2)
			  AND ((status = 'pending' AND next_retry <= NOW())
			    OR (status = 'processing' AND updated_at < NOW() - INTERVAL '60 seconds'))
			ORDER BY next_retry
			LIMIT $1
			FOR UPDATE SKIP LOCKED`,
			batchSize, names)
	}
	if err != nil {
		return nil, err
	}

	var entries []Entry
	for rows.Next() {
		var e Entry
		if err := rows.Scan(&e.ID, &e.Name, &e.ExternalID, &e.Input, &e.MaxAttempts); err != nil {
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
			`UPDATE fookie_outbox SET status='processing', updated_at=NOW() WHERE external_id=$1`,
			e.ExternalID); err != nil {
			return nil, err
		}
	}
	return entries, tx.Commit(ctx)
}

func Waiters(ctx context.Context, pool *pgxpool.Pool, externalID string) ([]Waiter, error) {
	rows, err := pool.Query(ctx,
		`SELECT w.outbox_id, w.model, w.entity_id
		 FROM fookie_outbox_waiter w
		 JOIN fookie_outbox o ON o.id = w.outbox_id
		 WHERE o.external_id = $1`,
		externalID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var waiters []Waiter
	for rows.Next() {
		var w Waiter
		if err := rows.Scan(&w.OutboxID, &w.Model, &w.EntityID); err != nil {
			return nil, err
		}
		waiters = append(waiters, w)
	}
	return waiters, rows.Err()
}

type SagaStep struct {
	StepName   string
	Compensate string
	InputJSON  []byte
	OutputJSON []byte
}

func (s SagaStep) CompensateInput() []byte {
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

func RecordSagaStep(tx pgx.Tx, entityID, model, stepName, compensate string, inputJSON, outputJSON []byte) error {
	_, err := tx.Exec(context.Background(),
		`INSERT INTO fookie_saga_step (id, entity_id, model, step_name, compensate, input_json, output_json)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)
		 ON CONFLICT (entity_id, model, step_name) DO NOTHING`,
		platform.NewUUIDv7(), entityID, model, stepName, compensate, string(inputJSON), string(outputJSON))
	return err
}

func LoadSagaSteps(tx pgx.Tx, entityID, model string) ([]SagaStep, error) {
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
	var steps []SagaStep
	for rows.Next() {
		var s SagaStep
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

func ClearSagaSteps(tx pgx.Tx, entityID, model string) error {
	_, err := tx.Exec(context.Background(),
		`DELETE FROM fookie_saga_step WHERE entity_id = $1 AND model = $2`,
		entityID, model)
	return err
}

func DeleteWaiters(ctx context.Context, pool *pgxpool.Pool, externalID string) error {
	_, err := pool.Exec(ctx,
		`DELETE FROM fookie_outbox_waiter
		 WHERE outbox_id = (SELECT id FROM fookie_outbox WHERE external_id = $1)`,
		externalID)
	return err
}

func CompletedWaiterRows(ctx context.Context, pool *pgxpool.Pool) ([]CompletedWaiter, error) {
	rows, err := pool.Query(ctx,
		`SELECT o.external_id, w.model, w.entity_id
		 FROM fookie_outbox_waiter w
		 JOIN fookie_outbox o ON o.id = w.outbox_id
		 WHERE o.status = 'completed'`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var result []CompletedWaiter
	for rows.Next() {
		var cw CompletedWaiter
		if err := rows.Scan(&cw.ExternalID, &cw.Model, &cw.EntityID); err != nil {
			return nil, err
		}
		result = append(result, cw)
	}
	return result, rows.Err()
}

func LookupCompensateName(tx pgx.Tx, links map[string]string, serviceName string) (string, bool, error) {
	if name, ok := links[serviceName]; ok {
		return name, true, nil
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
