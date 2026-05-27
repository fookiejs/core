package fookie

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
)

var ErrIdempotencyKeyEmpty = errors.New("idempotency key empty")

type idempotencyRecord struct {
	StatusCode int
	Body       map[string]any
}

func (d *db) migrateIdempotency() error {
	_, err := d.pool.Exec(context.Background(), `
		CREATE TABLE IF NOT EXISTS fookie_idempotency (
			idempotency_key TEXT NOT NULL,
			model           TEXT NOT NULL,
			response        JSONB NOT NULL,
			status_code     INT NOT NULL DEFAULT 201,
			created_at      TIMESTAMPTZ DEFAULT NOW(),
			PRIMARY KEY (idempotency_key, model)
		)`)
	if err != nil {
		return fmt.Errorf("idempotency table: %w", err)
	}
	return nil
}

func (d *db) lookupIdempotency(ctx context.Context, model, key string) (map[string]any, int, error) {
	rec, err := d.idempotencyGet(ctx, model, key)
	if err != nil || rec == nil {
		return nil, 0, err
	}
	return rec.Body, rec.StatusCode, nil
}

func (d *db) storeIdempotency(ctx context.Context, model, key string, response map[string]any, statusCode int) error {
	return d.idempotencyPut(ctx, model, key, response, statusCode)
}

func (d *db) idempotencyGet(ctx context.Context, model, key string) (*idempotencyRecord, error) {
	var raw []byte
	var status int
	err := d.pool.QueryRow(ctx,
		`SELECT response, status_code FROM fookie_idempotency WHERE idempotency_key = $1 AND model = $2`,
		key, model).Scan(&raw, &status)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	var body map[string]any
	if err := json.Unmarshal(raw, &body); err != nil {
		return nil, err
	}
	return &idempotencyRecord{StatusCode: status, Body: body}, nil
}

func (d *db) idempotencyPut(ctx context.Context, model, key string, response map[string]any, statusCode int) error {
	raw, err := json.Marshal(response)
	if err != nil {
		return err
	}
	_, err = d.pool.Exec(ctx,
		`INSERT INTO fookie_idempotency (idempotency_key, model, response, status_code)
		 VALUES ($1, $2, $3, $4)
		 ON CONFLICT (idempotency_key, model) DO NOTHING`,
		key, model, string(raw), statusCode)
	return err
}
