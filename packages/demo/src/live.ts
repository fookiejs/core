import pg from "pg";
import { Method, realtime } from "@fookiejs/realtime";
import { NotifyBus } from "@fookiejs/postgresql";
import type { InjectablePool } from "@fookiejs/postgresql";
import { bead, createFookie, databaseUrl } from "./model.ts";

type Fookie = ReturnType<typeof createFookie>;

function notifyPool(): InjectablePool & { close(): Promise<void> } {
  const raw = new pg.Pool({ connectionString: databaseUrl });
  return {
    query: (sql: string, params = []) => raw.query(sql, params),
    connect: () => raw.connect(),
    end: [() => raw.end()],
    close: () => raw.end(),
  };
}

export function createLive(fookie: Fookie) {
  const pool = notifyPool();
  const live = realtime(
    [
      {
        model: bead,
        method: Method.UPDATE,
        who(clientIds) {
          return clientIds;
        },
      },
    ],
    {
      listen: [],
      bus: [NotifyBus({ pool })],
      batch: [{ windowMs: 50, max: 128 }],
    },
  );
  live.watch(fookie);
  return {
    live,
    async stop() {
      await live.stop();
      await pool.close();
    },
  };
}
