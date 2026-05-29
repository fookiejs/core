package model

import (
	"fmt"

	"github.com/fookiejs/fookie/internal/persistence/store"
)

type Composer interface {
	OpTx() *OpTx
	OpHeaders() map[string]string
	Savepoint(func() (Signal, *FailError)) Signal
}

func (c *Flow[F]) OpTx() *OpTx { return c.requireOpTx() }

func (c *Flow[F]) OpHeaders() map[string]string { return c.Headers }

func (c *Flow[F]) Savepoint(run func() (Signal, *FailError)) Signal { return c.withSavepoint(run) }

func (c *Flow[F]) requireOpTx() *OpTx {
	if c.operationTransaction == nil {
		fail(fmt.Errorf("flow not bound to transaction"))
	}
	return c.operationTransaction
}

func (c *Flow[F]) withSavepoint(run func() (Signal, *FailError)) Signal {
	operationTransaction := c.requireOpTx()
	savepoint := operationTransaction.NextSavepoint()
	ctx := c.execContext()
	if err := store.SavepointTx(ctx, c.transaction, savepoint); err != nil {
		fail(fmt.Errorf("savepoint: %w", err))
	}
	signal, failError := run()
	if signal == Failed {
		_ = store.RollbackToSavepointTx(ctx, c.transaction, savepoint)
		if failError != nil {
			c.failErr = failError
		}
		return Failed
	}
	_ = store.ReleaseSavepointTx(ctx, c.transaction, savepoint)
	return signal
}
