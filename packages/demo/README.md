# fookie demo

A 3×3 plane. Beads are global. GraphQL loads them. SSE is `/stream?client=`. Motion runs in a separate tick process.

From the repo root (`core/`):

```bash
npm install
npm run db:up -w @fookiejs/demo
npm start -w @fookiejs/demo
```

Single process: space + analyze + tick together.

Or docker, independently scaled:

```bash
npm run up -w @fookiejs/demo
```

That is 1 postgres, 1 redis, 10 fookie (GraphQL + page), 10 realtime (`/stream`), 1 tick, 1 analyze, nginx in front.

```
space    http://127.0.0.1:3001
analyze  http://127.0.0.1:4300/?token=demo
```

`/` and GraphQL go to fookie. `/stream` goes to realtime. Both read the same postgres notify. `who` only sees connections on that realtime process.

WASD to change rooms. Click in your room to poke hue or drop a bead.

`Bead` lives on Redis. Control lives on Postgres. `npm run fuzz -w @fookiejs/demo` throws generated steps at `Bead`.

Host ports when using `db:up`: Postgres 5433, Redis 6381.

```bash
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5433/fookie_demo REDIS_URL=redis://127.0.0.1:6381 npm start -w @fookiejs/demo
```

Stop with `npm run down -w @fookiejs/demo`.

## License

MIT
