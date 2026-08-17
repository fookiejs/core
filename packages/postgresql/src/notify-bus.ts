import { z } from "zod";
import type { RealtimeBus, BusSubscription } from "@fookiejs/realtime";
import type { SettledEvent } from "@fookiejs/realtime";
import { appendItem } from "@fookiejs/core";
import type { InjectablePool } from "./pool.ts";

export const settledChannel = "fookie_settled";

export type NotifyBusOptions = {
  pool: InjectablePool;
};

function encodeEvent(event: SettledEvent): string {
  return JSON.stringify({
    model: event.model,
    operation: event.operation,
    id: event.id,
    runId: event.runId,
    signal: event.signal,
  });
}

function decodeEvent(payload: string): readonly SettledEvent[] {
  try {
    const raw: unknown = JSON.parse(payload);
    const parsed = z
      .object({
        model: z.string().min(1),
        operation: z.string().min(1),
        id: z.string().min(1),
        runId: z.string().min(1),
        signal: z.string().min(1),
      })
      .safeParse(raw);
    if (parsed.success === false) {
      return [];
    }
    return [parsed.data];
  } catch {
    return [];
  }
}

export function NotifyBus(options: NotifyBusOptions): RealtimeBus {
  const listenersBox: { listeners: readonly ((event: SettledEvent) => void)[] } = {
    listeners: [],
  };
  const listenBox: { client: Awaited<ReturnType<InjectablePool["connect"]>> | null } = {
    client: null,
  };
  let starting: Promise<boolean> | null = null;

  async function ensureListen(): Promise<boolean> {
    if (listenBox.client !== null) {
      return true;
    }
    if (starting !== null) {
      return await starting;
    }
    starting = (async () => {
      const client = await options.pool.connect();
      listenBox.client = client;
      const raw = client as unknown as {
        on(event: string, listener: (message: { channel: string; payload: string }) => void): void;
        query(sql: string): Promise<unknown>;
      };
      raw.on("notification", (message) => {
        if (message.channel !== settledChannel) {
          return;
        }
        for (const event of decodeEvent(message.payload)) {
          for (const listener of listenersBox.listeners) {
            listener(event);
          }
        }
      });
      await raw.query(`LISTEN ${settledChannel}`);
      return true;
    })();
    try {
      return await starting;
    } finally {
      starting = null;
    }
  }

  return {
    async publish(event) {
      await ensureListen();
      const payload = encodeEvent(event);
      await options.pool.query(`SELECT pg_notify($1, $2)`, [settledChannel, payload]);
      return 1;
    },
    subscribe(listener) {
      listenersBox.listeners = appendItem(listenersBox.listeners, listener);
      void ensureListen();
      const subscription: BusSubscription = {
        stop() {
          const before = listenersBox.listeners.length;
          listenersBox.listeners = listenersBox.listeners.filter(
            (registered) => registered !== listener,
          );
          return listenersBox.listeners.length < before;
        },
      };
      return subscription;
    },
  };
}
