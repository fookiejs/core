package flowext

import (
	"context"
	"fmt"

	"github.com/fookiejs/fookie/internal/model/schemawire"
	"github.com/fookiejs/fookie/internal/observability"
	"github.com/fookiejs/fookie/internal/observability/telemetry"
)

func MarkEntityFailed(reqCtx context.Context, app AppRef, stored *schemawire.StoredModel, entityID, reason, traceID string) {
	_, _ = app.DB().Pool.Exec(reqCtx,
		fmt.Sprintf(`UPDATE "%s" SET "_fookie_status"='failed', "_fookie_error"=$1 WHERE "id"=$2`, stored.Name),
		reason, entityID)
	telemetry.FlowFailed(reqCtx, stored.Name, entityID, reason)
	observability.Warn("entity.failed", observability.ModelKey, stored.Name, observability.EntityIDKey, entityID, "trace_id", traceID, observability.ErrKey, reason)
}
