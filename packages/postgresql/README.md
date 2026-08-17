# @fookiejs/postgresql

Postgres engine for fookie models: transactions, tables, outbox/run persistence, and LISTEN/NOTIFY. Saga lives in `@fookiejs/core`.

```ts
import { Postgres } from "@fookiejs/postgresql";

app({
  listen: "3001",
  database: Postgres("postgres://localhost/app"),
  models,
  externals,
  onExternalEvent,
});
```

A model without `database` inherits `app.database`. Tests inject a pool instead of opening sockets:

```ts
Postgres("postgres://mock", [db]);
```

Retention is a store parameter, not a model parameter. `softDelete: false` makes `app.delete` remove the row:

```ts
Postgres("postgres://localhost/app", [], { softDelete: false });
```

`@fookiejs/core` is a peer dependency.

## License

MIT
