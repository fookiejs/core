package reliability

import (
	"context"
	"time"

	"github.com/fookiejs/fookie/internal/observability"
	"github.com/fookiejs/fookie/internal/reliability/outbox"
)

const (
	outboxBatchSize    = 10
	outboxPollDefault  = 500 * time.Millisecond
	msgFailUpdateError = "outbox.fail_update_error"
)

func StartOutboxWorker(app App) {
	go runOutboxWorker(app)
}

func runOutboxWorker(app App) {
	interval := outboxPollDefault
	timer := time.NewTimer(interval)
	defer timer.Stop()

	for range timer.C {
		processOutboxBatch(app)
		sweepCompletedWaiters(app)
		timer.Reset(interval)
	}
}

func processOutboxBatch(app App) {
	ctx := context.Background()

	var names []string
	if app.ExternalBusEnabled() {
		names = nil
	} else {
		handlers := app.ExternalHandlers()
		names = make([]string, 0, len(handlers))
		for n := range handlers {
			names = append(names, n)
		}
		if len(names) == 0 {
			return
		}
	}

	entries, err := outbox.ClaimBatch(ctx, app.DB().Pool, outboxBatchSize, names)
	if err != nil {
		observability.Warn("outbox.claim_error", observability.ErrKey, err.Error())
		return
	}

	for _, entry := range entries {
		processOutboxEntry(ctx, app, entry)
	}
}

func processOutboxEntry(ctx context.Context, app App, entry outbox.Entry) {
	if app.ExternalBusEnabled() {
		if err := app.PublishExternal(entry.Name, entry.ExternalID, entry.Input); err != nil {
			observability.Warn("outbox.publish_error", observability.ServiceKey, entry.Name, observability.ExternalID, entry.ExternalID, observability.ErrKey, err.Error())
			if failErr := outbox.Fail(ctx, app.DB().Pool, entry.ExternalID, err.Error()); failErr != nil {
				observability.Warn(msgFailUpdateError, observability.ExternalID, entry.ExternalID, observability.ErrKey, failErr.Error())
			}
		}
		return
	}

	handler, ok := app.ExternalHandlers()[entry.Name]
	if !ok {
		observability.Warn("outbox.no_handler", observability.ServiceKey, entry.Name, observability.ExternalID, entry.ExternalID)
		if err := outbox.Fail(ctx, app.DB().Pool, entry.ExternalID, "no handler registered"); err != nil {
			observability.Warn(msgFailUpdateError, observability.ExternalID, entry.ExternalID, observability.ErrKey, err.Error())
		}
		return
	}

	observability.Debug("outbox.start", observability.ServiceKey, entry.Name, observability.ExternalID, entry.ExternalID)

	start := time.Now()
	output, err := handler(ctx, entry.Input)
	dur := observability.MsElapsed(start)

	if err != nil {
		observability.ExternalRetry(ctx, entry.Name, map[string]string{observability.ExternalID: entry.ExternalID, "error_phase": "handler"})
		observability.SchedulerRetry(ctx, entry.Name, map[string]string{observability.ExternalID: entry.ExternalID})
		observability.Warn("outbox.handler_error",
			observability.ServiceKey, entry.Name,
			observability.ExternalID, entry.ExternalID,
			observability.DurationMsKey, dur,
			observability.ErrKey, err.Error())
		if failErr := outbox.Fail(ctx, app.DB().Pool, entry.ExternalID, err.Error()); failErr != nil {
			observability.Warn(msgFailUpdateError, observability.ExternalID, entry.ExternalID, observability.ErrKey, failErr.Error())
		}
		return
	}

	if err := outbox.Complete(ctx, app.DB().Pool, entry.ExternalID, output); err != nil {
		observability.Warn("outbox.complete_error",
			observability.ServiceKey, entry.Name,
			observability.ExternalID, entry.ExternalID,
			observability.DurationMsKey, dur,
			observability.ErrKey, err.Error())
		return
	}

	observability.Info("outbox.completed",
		observability.ServiceKey, entry.Name,
		observability.ExternalID, entry.ExternalID,
		observability.DurationMsKey, dur)

	resumeAndDeleteWaiters(ctx, app, entry.ExternalID)
}

func sweepCompletedWaiters(app App) {
	ctx := context.Background()
	rows, err := outbox.CompletedWaiterRows(ctx, app.DB().Pool)
	if err != nil {
		observability.Warn("outbox.sweep_error", observability.ErrKey, err.Error())
		return
	}
	seen := make(map[string]bool)
	for _, cw := range rows {
		app.ResumeEntity(cw.Model, cw.EntityID)
		if !seen[cw.ExternalID] {
			seen[cw.ExternalID] = true
			if err := outbox.DeleteWaiters(ctx, app.DB().Pool, cw.ExternalID); err != nil {
				observability.Warn("outbox.delete_waiters_error", observability.ExternalID, cw.ExternalID, observability.ErrKey, err.Error())
			}
		}
	}
}

func resumeAndDeleteWaiters(ctx context.Context, app App, externalID string) {
	waiters, err := outbox.Waiters(ctx, app.DB().Pool, externalID)
	if err != nil {
		observability.Warn("outbox.waiters_error", observability.ExternalID, externalID, observability.ErrKey, err.Error())
		return
	}
	for _, w := range waiters {
		app.ResumeEntity(w.Model, w.EntityID)
	}
	if err := outbox.DeleteWaiters(ctx, app.DB().Pool, externalID); err != nil {
		observability.Warn("outbox.delete_waiters_error", observability.ExternalID, externalID, observability.ErrKey, err.Error())
	}
}
