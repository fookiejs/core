# @fookiejs/core

Model-driven TypeScript framework with observable flows, PostgreSQL persistence, and outbox-based externals.

## Install

```bash
npm install @fookiejs/core pg zod
```

## Quick start

See `example.ts` for the full contract. Run locally:

```bash
npm install
npm run build
npm run example
```

Requires PostgreSQL at `postgres://localhost:5432/fookie` when running the example.

## API

- `Model`, `External`, `Types`, `flows`, `app`
- CRUD via `fookie.create`, `list`, `update`, `delete`
- Saga resume via `fookie.resume(runId)` and `fookie.setExternalResult`
- HTTP server via `fookie.run()` — `POST /{model}/create`, `/list`, `/{id}/update`, `/{id}/delete`, `/external/result`
- Observability via `fookie.logs()`, `fookie.metrics()`, `fookie.spans()`
- OpenTelemetry: spans, counters, and histograms are emitted through `@opentelemetry/api` — register any OTel SDK/exporter in your app and framework telemetry flows to it; without an SDK the calls are no-ops

## Scripts

| Script | Description |
|--------|-------------|
| `npm test` | Run tests (node:test) |
| `npm run test:coverage` | Coverage (99%+ lines) |
| `npm run build` | Compile to `dist/` |
| `npm run example` | Run `example.ts` against local `src` |

## PostgreSQL integration test

```bash
FOOKIE_TEST_DATABASE=postgres://localhost:5432/fookie_test npm test
```
