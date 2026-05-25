package fookie

import (
	"context"
	"time"

	"github.com/fookiejs/fookie/internal/telemetry"
)

const (
	outboxBatchSize   = 10
	outboxPollDefault = 500 * time.Millisecond
)

func startOutboxWorker(app *App) {
	go runOutboxWorker(app)
}

func runOutboxWorker(app *App) {
	interval := outboxPollDefault
	timer := time.NewTimer(interval)
	defer timer.Stop()

	for range timer.C {
		processOutboxBatch(app)
		sweepCompletedWaiters(app)
		timer.Reset(interval)
	}
}

func processOutboxBatch(app *App) {
	ctx := context.Background()

	names := make([]string, 0, len(app.externalHandlers))
	for n := range app.externalHandlers {
		names = append(names, n)
	}
	if len(names) == 0 {
		return
	}

	entries, err := outboxClaimBatch(ctx, app.db.pool, outboxBatchSize, names)
	if err != nil {
		flog.Warn("outbox.claim_error", flogErr, err.Error())
		return
	}

	for _, entry := range entries {
		processOutboxEntry(ctx, app, entry)
	}
}

func processOutboxEntry(ctx context.Context, app *App, entry outboxEntry) {
	h, ok := app.externalHandlers[entry.Name]
	if !ok {
		flog.Warn("outbox.no_handler", flogService, entry.Name, flogCallKey, entry.CallKey)
		return
	}

	flog.Debug("outbox.start", flogService, entry.Name, flogCallKey, entry.CallKey)

	start := time.Now()
	output, err := h(ctx, entry.Input)
	dur := msElapsed(start)

	if err != nil {
		telemetry.EmitHistogram("runtime.outbox.duration", dur, map[string]string{"service": entry.Name, "result": "error"})
		telemetry.EmitTrace("trc_outbox", "runtime.outbox", "external.retrying", map[string]string{
			"service":     entry.Name,
			flogCallKey:   entry.CallKey,
			"error_phase": "handler",
		})
		flog.Warn("outbox.handler_error",
			flogService, entry.Name,
			flogCallKey, entry.CallKey,
			flogDurationMs, dur,
			flogErr, err.Error())
		if failErr := outboxFail(ctx, app.db.pool, entry.CallKey, err.Error()); failErr != nil {
			flog.Warn("outbox.fail_update_error", flogCallKey, entry.CallKey, flogErr, failErr.Error())
		}
		return
	}

	if err := outboxComplete(ctx, app.db.pool, entry.CallKey, output); err != nil {
		flog.Warn("outbox.complete_error",
			flogService, entry.Name,
			flogCallKey, entry.CallKey,
			flogDurationMs, dur,
			flogErr, err.Error())
		return
	}

	telemetry.EmitHistogram("runtime.outbox.duration", dur, map[string]string{"service": entry.Name, "result": "ok"})
	telemetry.EmitCounter("runtime.outbox.processed", map[string]string{"service": entry.Name})
	flog.Info("outbox.completed",
		flogService, entry.Name,
		flogCallKey, entry.CallKey,
		flogDurationMs, dur)

	resumeAndDeleteWaiters(ctx, app, entry.CallKey)
}

func sweepCompletedWaiters(app *App) {
	ctx := context.Background()
	rows, err := outboxCompletedWaiterRows(ctx, app.db.pool)
	if err != nil {
		flog.Warn("outbox.sweep_error", flogErr, err.Error())
		return
	}
	seen := make(map[string]bool)
	for _, cw := range rows {
		app.resumeEntity(cw.Model, cw.EntityID)
		if !seen[cw.CallKey] {
			seen[cw.CallKey] = true
			if err := outboxDeleteWaiters(ctx, app.db.pool, cw.CallKey); err != nil {
				flog.Warn("outbox.delete_waiters_error", flogCallKey, cw.CallKey, flogErr, err.Error())
			}
		}
	}
}

func resumeAndDeleteWaiters(ctx context.Context, app *App, callKey string) {
	waiters, err := outboxWaiters(ctx, app.db.pool, callKey)
	if err != nil {
		flog.Warn("outbox.waiters_error", flogCallKey, callKey, flogErr, err.Error())
		return
	}
	for _, w := range waiters {
		app.resumeEntity(w.Model, w.EntityID)
	}
	if err := outboxDeleteWaiters(ctx, app.db.pool, callKey); err != nil {
		flog.Warn("outbox.delete_waiters_error", flogCallKey, callKey, flogErr, err.Error())
	}
}
