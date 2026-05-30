package persistence

import (
	"github.com/fookiejs/fookie/internal/persistence/store"
	"github.com/jackc/pgx/v5"
)

func SumTx(transaction pgx.Tx, table store.Table, column, excludeID string, filters []store.Filter) (int64, error) {
	return store.SumTx(transaction, table, column, excludeID, filters)
}
