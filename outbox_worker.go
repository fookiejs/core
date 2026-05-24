package fookie

import (
	"context"
	"log/slog"
	"time"
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
		timer.Reset(interval)
	}
}

func processOutboxBatch(app *App) {
	ctx := context.Background()

	entries, err := outboxClaimBatch(ctx, app.db.pool, outboxBatchSize)
	if err != nil {
		slog.Warn("fookie: outbox claim batch", "err", err)
		return
	}

	for _, entry := range entries {
		processOutboxEntry(ctx, app, entry)
	}
}

func processOutboxEntry(ctx context.Context, app *App, entry outboxEntry) {
	if err := outboxMarkProcessing(ctx, app.db.pool, entry.CallKey); err != nil {
		slog.Warn("fookie: outbox mark processing", "key", entry.CallKey, "err", err)
		return
	}

	h, ok := app.externalHandlers[entry.Name]
	if !ok {
		slog.Warn("fookie: no handler for external", "name", entry.Name)
		return
	}

	output, err := h(ctx, entry.Input)
	if err != nil {
		slog.Warn("fookie: external handler error", "name", entry.Name, "err", err)
		if failErr := outboxFail(ctx, app.db.pool, entry.CallKey, err.Error(), entry.MaxAttempts); failErr != nil {
			slog.Warn("fookie: outbox fail update", "key", entry.CallKey, "err", failErr)
		}
		return
	}

	if err := outboxComplete(ctx, app.db.pool, entry.CallKey, output); err != nil {
		slog.Warn("fookie: outbox complete", "key", entry.CallKey, "err", err)
		return
	}

	waiters, err := outboxWaiters(ctx, app.db.pool, entry.CallKey)
	if err != nil {
		slog.Warn("fookie: outbox waiters", "key", entry.CallKey, "err", err)
		return
	}

	for _, w := range waiters {
		app.resumeEntity(w.Model, w.EntityID)
	}
}
