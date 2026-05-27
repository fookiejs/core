package fookie

import (
	"context"

	"github.com/fookiejs/fookie/internal/telemetry"
)

func traceIDForEntity(entityID string) string {
	if entityID == "" {
		return "trc_" + newUUIDv7()
	}
	return "trc_" + entityID
}

func emitGraphQLReceived(ctx context.Context, op string) {
	telemetry.GraphQLReceived(ctx, op)
}

func emitGraphQLDuration(ctx context.Context, op string, ms float64, failed bool) {
	telemetry.GraphQLDuration(ctx, op, ms)
	if failed {
		telemetry.GraphQLFailed(ctx, op)
	}
}
