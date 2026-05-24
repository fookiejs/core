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
	return err
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

func outboxFail(ctx context.Context, pool *pgxpool.Pool, callKey, reason string, maxAttempts int) error {
	_, err := pool.Exec(ctx,
		`UPDATE fookie_outbox
		 SET attempts = attempts + 1,
		     error_msg = $1,
		     status = CASE WHEN attempts + 1 >= max_attempts THEN 'failed' ELSE 'pending' END,
		     next_retry = NOW() + (INTERVAL '1 second' * LEAST(POWER(2, attempts), $2)),
		     updated_at = NOW()
		 WHERE call_key = $3`,
		reason, maxAttempts, callKey)
	return err
}

func outboxClaimBatch(ctx context.Context, pool *pgxpool.Pool, batchSize int) ([]outboxEntry, error) {
	rows, err := pool.Query(ctx, `
		SELECT id, name, call_key, input, max_attempts
		FROM fookie_outbox
		WHERE status = 'pending' AND next_retry <= NOW()
		ORDER BY next_retry
		LIMIT $1
		FOR UPDATE SKIP LOCKED`,
		batchSize)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var entries []outboxEntry
	for rows.Next() {
		var e outboxEntry
		if err := rows.Scan(&e.ID, &e.Name, &e.CallKey, &e.Input, &e.MaxAttempts); err != nil {
			return nil, err
		}
		entries = append(entries, e)
	}
	return entries, rows.Err()
}

func outboxMarkProcessing(ctx context.Context, pool *pgxpool.Pool, callKey string) error {
	_, err := pool.Exec(ctx,
		`UPDATE fookie_outbox SET status='processing', updated_at=NOW() WHERE call_key=$1`,
		callKey)
	return err
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
