# Fookie core

Go runtime: loads **schema.bundle.json**, applies migrations, exposes **GraphQL**, runs **cron**, **outbox** workers for externals, and optional saga-style compensation.

Schema is authored in Go (see repo `demo/bank` and `core/core` DSL) and emitted as a bundle.

## Run locally

From this directory, use your schema path and database URL (see `cmd/server` and `pkg/host`). The `demo` compose stack is a full example with Postgres and Redis.

## License

See [`LICENSE`](LICENSE) in this directory.
