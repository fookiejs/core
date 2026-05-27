# Fookie

Go library for schema-first apps: models, hooks, internals, externals, Postgres migrations, and HTTP API.

Import as `github.com/fookiejs/fookie` and `github.com/fookiejs/fookie/semantic`.

See `../demo/bank` for an example app. GraphQL (`/graphql`) is consumed from `@fookiejs/client` or any HTTP client; there is no Go CLI in this repo.

Telemetry is optional and exports only through OTLP (gRPC or HTTP). Core does not know Prometheus, Grafana, or any other backend; an OpenTelemetry Collector routes metrics and traces. Set `OTEL_ENABLED=true` and `OTEL_EXPORTER_OTLP_ENDPOINT` before `App.Run()`. User metrics: `flow.Metric.Increment`, `Histogram`, `Gauge` with `custom.*` names only.
