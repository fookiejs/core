package persistence

import (
	"github.com/fookiejs/fookie/internal/persistence/store"
	"github.com/jackc/pgx/v5"
)

func AdvisoryLockTx(tx pgx.Tx, key string) error {
	return store.AdvisoryLock(tx, key)
}

func SumTx(tx pgx.Tx, table store.Table, column, excludeID string, filters []store.Filter) (int64, error) {
	return store.SumTx(tx, table, column, excludeID, filters)
}
