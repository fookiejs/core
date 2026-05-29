package reliability

import (
	"context"

	"github.com/fookiejs/fookie/internal/reliability/outbox"
)

func ReportSuccess(app App, externalID string, output []byte) error {
	ctx := context.Background()
	if err := outbox.Complete(ctx, app.DB().Pool, externalID, output); err != nil {
		return err
	}
	resumeAndDeleteWaiters(ctx, app, externalID)
	return nil
}

func ReportFailure(app App, externalID, reason string) error {
	ctx := context.Background()
	if err := outbox.Fail(ctx, app.DB().Pool, externalID, reason); err != nil {
		return err
	}
	terminal, err := outbox.IsTerminalFailed(ctx, app.DB().Pool, externalID)
	if err != nil {
		return err
	}
	if terminal {
		resumeAndDeleteWaiters(ctx, app, externalID)
	}
	return nil
}
