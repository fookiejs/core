package flowext

import (
	"context"
	"fmt"
	"sync/atomic"

	"github.com/jackc/pgx/v5"
)

type OpTx struct {
	Ctx     context.Context
	Tx      pgx.Tx
	App     AppRef
	Headers map[string]string
	sp      uint64
}

func NewOpTx(ctx context.Context, transaction pgx.Tx, app AppRef, headers map[string]string) *OpTx {
	h := map[string]string{}
	for k, v := range headers {
		h[k] = v
	}
	return &OpTx{Ctx: ctx, Tx: transaction, App: app, Headers: h}
}

func (o *OpTx) NextSavepoint() string {
	n := atomic.AddUint64(&o.sp, 1)
	return fmt.Sprintf("fookie_sp_%d", n)
}
