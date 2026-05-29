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
	if c.otx == nil {
		fail(fmt.Errorf("flow not bound to transaction"))
	}
	return c.otx
}

func (c *Flow[F]) withSavepoint(run func() (Signal, *FailError)) Signal {
	otx := c.requireOpTx()
	sp := otx.NextSavepoint()
	ctx := c.execContext()
	if err := store.SavepointTx(ctx, c.tx, sp); err != nil {
		fail(fmt.Errorf("savepoint: %w", err))
	}
	sig, ferr := run()
	if sig == Failed {
		_ = store.RollbackToSavepointTx(ctx, c.tx, sp)
		if ferr != nil {
			c.failErr = ferr
		}
		return Failed
	}
	_ = store.ReleaseSavepointTx(ctx, c.tx, sp)
	return sig
}
