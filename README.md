# Fookie

Go library for schema-first apps: models, hooks, internals, externals, Postgres migrations, and HTTP API.

Import as `github.com/fookiejs/fookie` and `github.com/fookiejs/fookie/semantic`.

See `../demo/bank` for an example app.

Telemetry is append-only JSON on stdout (`type`: `metric` or `trace`). Core does not export to Prometheus or store aggregates. User metrics: `flow.Metric.Increment`, `Histogram`, `Gauge` with `custom.*` names only. See `../docs/telemetry-events.md`.
