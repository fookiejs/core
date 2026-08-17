# @fookiejs/otlp

Optional OTLP sink. Call `otlp(serviceName)` once at boot. When
`OTEL_EXPORTER_OTLP_ENDPOINT` is set, a NodeSDK exports traces and metrics.
When it is unset, the call is a no-op. Core keeps its in-process ring; Analyze
reads that ring plus durable outbox/run. Long-term history is the host's
collector — not a fookie table.
