package persistence

import "github.com/fookiejs/fookie/internal/persistence/store"

type DB struct {
	*store.DB
}

func OpenDB(connStr string) (*DB, error) {
	s, err := store.Open(connStr)
	if err != nil {
		return nil, err
	}
	return &DB{DB: s}, nil
}
