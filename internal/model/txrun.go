package model

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

const txMaxAttempts = 5

type txBeginner interface {
	Begin(ctx context.Context) (pgx.Tx, error)
}

func RunInTx(ctx context.Context, db txBeginner, fn func(tx pgx.Tx) (Signal, *FailError, error)) (Signal, *FailError, error) {
	var lastInfra error
	for attempt := 0; attempt < txMaxAttempts; attempt++ {
		if attempt > 0 {
			time.Sleep(time.Duration(attempt) * 20 * time.Millisecond)
		}
		tx, err := db.Begin(ctx)
		if err != nil {
			return Failed, nil, err
		}
		sig, ferr, opErr := fn(tx)
		if opErr != nil {
			_ = tx.Rollback(ctx)
			if isRetryablePg(opErr) && attempt+1 < txMaxAttempts {
				lastInfra = opErr
				continue
			}
			return Failed, ferr, opErr
		}
		if sig == Failed {
			_ = tx.Rollback(ctx)
			return Failed, ferr, nil
		}
		if err := tx.Commit(ctx); err != nil {
			_ = tx.Rollback(ctx)
			if isRetryablePg(err) && attempt+1 < txMaxAttempts {
				lastInfra = err
				continue
			}
			return Failed, nil, err
		}
		return sig, nil, nil
	}
	if lastInfra != nil {
		return Failed, nil, lastInfra
	}
	return Failed, nil, errors.New("transaction retries exhausted")
}

func isRetryablePg(err error) bool {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code == "40001" || pgErr.Code == "40P01"
	}
	return false
}
