package fookie

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

const telemetryBuf = 2048

type logEntry struct {
	id        string
	ts        time.Time
	model     string
	operation string
	method    string
	path      string
	status    int
	durMs     int64
	errCode   string
	errDesc   string
}

type telemetry struct {
	pool *pgxpool.Pool
	ch   chan logEntry
}

func newTelemetry(pool *pgxpool.Pool) *telemetry {
	t := &telemetry{pool: pool, ch: make(chan logEntry, telemetryBuf)}
	go t.worker()
	return t
}

func (t *telemetry) ensureTables() error {
	ctx := context.Background()
	_, err := t.pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS fookie_logs (
			id           TEXT PRIMARY KEY,
			ts           TIMESTAMPTZ NOT NULL,
			model        TEXT NOT NULL,
			operation    TEXT NOT NULL,
			method       TEXT NOT NULL,
			path         TEXT NOT NULL,
			status       INT  NOT NULL,
			duration_ms  BIGINT NOT NULL,
			error_code   TEXT,
			error_desc   TEXT
		)`)
	if err != nil {
		return err
	}
	_, err = t.pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS fookie_metrics (
			id           TEXT PRIMARY KEY,
			ts           TIMESTAMPTZ NOT NULL,
			model        TEXT NOT NULL,
			operation    TEXT NOT NULL,
			duration_ms  BIGINT NOT NULL,
			success      BOOLEAN NOT NULL
		)`)
	return err
}

func (t *telemetry) record(model, operation, method, path string, status int, dur time.Duration, err error) {
	if t == nil {
		return
	}
	code, desc := "", ""
	if err != nil {
		var fe *FailError
		if errors.As(err, &fe) {
			code, desc = fe.Code, fe.Description
		} else {
			code, desc = "internal", err.Error()
		}
	}
	entry := logEntry{
		id:        newUUIDv7(),
		ts:        time.Now().UTC(),
		model:     model,
		operation: operation,
		method:    method,
		path:      path,
		status:    status,
		durMs:     dur.Milliseconds(),
		errCode:   code,
		errDesc:   desc,
	}
	select {
	case t.ch <- entry:
	default:
	}
}

func (t *telemetry) worker() {
	for entry := range t.ch {
		ctx := context.Background()
		t.pool.Exec(ctx,
			`INSERT INTO fookie_logs (id,ts,model,operation,method,path,status,duration_ms,error_code,error_desc)
			 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
			entry.id, entry.ts, entry.model, entry.operation,
			entry.method, entry.path, entry.status, entry.durMs,
			nullStr(entry.errCode), nullStr(entry.errDesc),
		)
		t.pool.Exec(ctx,
			`INSERT INTO fookie_metrics (id,ts,model,operation,duration_ms,success)
			 VALUES ($1,$2,$3,$4,$5,$6)`,
			newUUIDv7(), entry.ts, entry.model, entry.operation,
			entry.durMs, entry.errCode == "",
		)
	}
}

func nullStr(s string) any {
	if s == "" {
		return nil
	}
	return s
}
