# Fookie core

Go library: schema bundle loading, SQL compiler, GraphQL layer, runtime executor, migrations, and CLI (`cmd/fookie`).

Apps define models in Go (`core/core` DSL) or emit `schema.bundle.json`, then embed or run against Postgres.

## Layout

| Path | Role |
|------|------|
| `pkg/` | Library code (ast, compiler, runtime, graphql, schema, migrate, …) |
| `core/` | Go authoring DSL (`github.com/fookiejs/fookie/core`) |
| `cmd/fookie` | CLI: compile, migrate, serve helper |
| `cmd/server`, `cmd/worker` | Optional binaries for running a full stack |
| `testdata/` | Fixture `schema.bundle.json` for tests |

Deployment (Helm, compose fleets, Grafana stacks) lives in **app repos** (e.g. `demo/docker-compose.yml`), not in this module.

## Tests

```bash
go test ./...
```

## License

See `LICENSE` if present in this directory.
