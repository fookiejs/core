package flowext

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/fookiejs/fookie/internal/model/schemawire"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

const txMaxAttempts = 5

type txBeginner interface {
	Begin(ctx context.Context) (pgx.Tx, error)
}

func RunInTx(ctx context.Context, database txBeginner, callback func(transaction pgx.Tx) (schemawire.Signal, *schemawire.FailError, error)) (schemawire.Signal, *schemawire.FailError, error) {
	var lastInfra error
	for attempt := 0; attempt < txMaxAttempts; attempt++ {
		if attempt > 0 {
			time.Sleep(time.Duration(attempt) * 20 * time.Millisecond)
		}
		transaction, err := database.Begin(ctx)
		if err != nil {
			return schemawire.Failed, nil, err
		}
		signal, failError, opErr := callback(transaction)
		if opErr != nil {
			_ = transaction.Rollback(ctx)
			if isRetryablePg(opErr) && attempt+1 < txMaxAttempts {
				lastInfra = opErr
				continue
			}
			return schemawire.Failed, failError, opErr
		}
		if signal == schemawire.Failed {
			_ = transaction.Rollback(ctx)
			return schemawire.Failed, failError, nil
		}
		if err := transaction.Commit(ctx); err != nil {
			_ = transaction.Rollback(ctx)
			if isRetryablePg(err) && attempt+1 < txMaxAttempts {
				lastInfra = err
				continue
			}
			return schemawire.Failed, nil, fmt.Errorf("commit transaction: %w", err)
		}
		return signal, nil, nil
	}
	if lastInfra != nil {
		return schemawire.Failed, nil, lastInfra
	}
	return schemawire.Failed, nil, errors.New("transaction retries exhausted")
}

func isRetryablePg(err error) bool {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code == "40001" || pgErr.Code == "40P01"
	}
	return false
}
