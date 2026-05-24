# Fookie server

Schema-first Go runtime: loads **`schema.bundle.json`** (built from Go schema code), applies migrations, exposes **GraphQL**, runs **cron**, **outbox** workers for externals, and optional **saga-style compensation**.

## Schema authoring

Define models, hooks, externals, seeds, and crons in Go using `pkg/ast` types, then emit a bundle:

```go
data, err := schemapkg.MarshalBundle(build())
os.WriteFile("schema.bundle.json", data, 0o644)
```

Scaffold a new app:

```bash
fookie init ./myapp
cd myapp/schema && go run .
fookie serve --schema ./schema
```

## Run locally

From this directory, use your schema path and database URL (see `cmd/server` and `pkg/host` for flags and env). The [`demo`](../demo) compose stack is a full example with Postgres and Redis.

## License

See [`LICENSE`](LICENSE) in this directory.
