package model

import (
	"context"
	"fmt"

	"github.com/fookiejs/fookie/internal/observability"
)

func markEntityFailed(reqCtx context.Context, app AppRef, stored *StoredModel, entityID, reason, traceID string) {
	_, _ = app.DB().Pool.Exec(reqCtx,
		fmt.Sprintf(`UPDATE "%s" SET "_fookie_status"='failed', "_fookie_error"=$1 WHERE "id"=$2`, stored.Name),
		reason, entityID)
	observability.FlowFailed(reqCtx, stored.Name, entityID, reason)
	observability.Warn("entity.failed", observability.ModelKey, stored.Name, observability.EntityIDKey, entityID, "trace_id", traceID, observability.ErrKey, reason)
}

func MarkEntityFailed(reqCtx context.Context, app AppRef, stored *StoredModel, entityID, reason, traceID string) {
	markEntityFailed(reqCtx, app, stored, entityID, reason, traceID)
}
