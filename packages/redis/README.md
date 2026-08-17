# @fookiejs/redis

Redis engine for fookie models. `create` / `list` / `update` / `delete` go through App. `app.sql` and `selectRows` are Postgres-only.

```ts
import { Redis } from "@fookiejs/redis";

Model({
  name: "Reading",
  database: Redis("redis://localhost:6379"),
  fields,
  flow,
});
```

A model without `database` inherits `app.database`. Tests inject a client instead of opening sockets:

```ts
Redis("redis://memory", [client]);
```

High-frequency metrics should set `softDelete: false` so a prune cron actually frees keys:

```ts
Redis("redis://localhost:6379", [], { softDelete: false });
```

`@fookiejs/core` is a peer dependency.

## License

MIT
