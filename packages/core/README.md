# @fookiejs/core

Model-driven TypeScript framework with observable flows and outbox-based externals. Persistence is `@fookiejs/postgresql` or `@fookiejs/redis`.

## Install

```bash
npm install @fookiejs/core @fookiejs/postgresql zod
```

## Quick start

See `example.ts` for the full contract. Run locally:

```bash
npm install
npm run build
npm run example
```

Requires PostgreSQL at `postgres://localhost:5432/fookie` when running the example.

```bash
docker compose up -d
```

## API

- `Model`, `External`, `Types`, `app`
- CRUD via `fookie.create`, `list`, `update`, `delete`
- Saga resume via `fookie.resume(runId)` and `fookie.setExternalResult`
- HTTP server via `fookie.run()` — `POST /{model}/create`, `/list`, `/{id}/update`, `/{id}/delete`. Settlement is `fookie.setExternalResult` / `fookie.setExternalFailure`.
- `fookie.listening()` resolves once the socket is actually accepting connections, with the port it bound.
  `run()` returns as soon as it has handed the socket to the OS, so a request issued on the next line races the
  bind. Await this instead. Pass `listen: "0"` to let the OS pick a free port and read it back from here.
- Shutdown via `fookie.stop()` — closes the HTTP server and owned database pool
- Observability via `fookie.logs()`, `fookie.metrics()`, `fookie.spans()`
- OpenTelemetry: spans, counters, and histograms are emitted through `@opentelemetry/api` — register any OTel SDK/exporter in your app and framework telemetry flows to it; without an SDK the calls are no-ops

## What happens when a step fails

An external that exhausts its attempts, or fails permanently, dead letters. The run then unwinds:
**every completed step that declared a compensation is undone, not only the step before the one that
failed.**

The walk dispatches those undos in reverse step order and dispatches all of them in one pass rather
than chaining each on the previous one's success. That is a deliberate choice. Chaining reads more
faithfully as "undo in strict reverse order", but it means a single undo that dead letters strands
every earlier step permanently un-undone — the stock stays held because the refund is stuck. Fanning
out gives each undo its own outbox row, its own attempts and its own dead letter, so a failure to
undo is visible per step instead of silently stopping the walk.

A step with no `compensate` declared is skipped and recorded as `compensation.skipped`, so "nothing
to undo" and "we forgot to undo" are distinguishable in the log.

The run's phase moves to `compensating` while undos are outstanding and `compensated` once they
settle. If nothing could be undone at all, the run is marked stuck and logged as `saga.stuck`.

## Scripts

| Script                  | Description                          |
| ----------------------- | ------------------------------------ |
| `npm test`              | Run tests (node:test)                |
| `npm run test:ci`       | Tests + lcov (CI)                    |
| `npm run coverage:gate` | Ratchet vs `scripts/coverage-baseline.json` |
| `npm run build`         | Compile to `dist/`                   |
| `npm run example`       | Run `example.ts` against local `src` |

## PostgreSQL integration test

```bash
FOOKIE_TEST_DATABASE=postgres://localhost:5432/fookie_test npm test
```
