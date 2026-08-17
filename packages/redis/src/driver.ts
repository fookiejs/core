import { z } from "zod";
import { createClient } from "redis";
import { DatabaseError, ValidationError } from "@fookiejs/core";
import { appendItem } from "@fookiejs/core";

export type RedisDriver = {
  connect(): Promise<boolean>;
  get(key: string): Promise<readonly string[]>;
  mGet(keys: readonly string[]): Promise<readonly (readonly string[])[]>;
  set(key: string, held: string): Promise<boolean>;
  del(key: string): Promise<boolean>;
  sAdd(key: string, member: string): Promise<boolean>;
  sRem(key: string, member: string): Promise<boolean>;
  sMembers(key: string): Promise<readonly string[]>;
  end: readonly (() => Promise<void>)[];
};

export function requireInjectedRedis(clients: readonly RedisDriver[]): RedisDriver {
  for (const client of clients) {
    if (z.looseObject({}).safeParse(client).success === false) {
      throw ValidationError.create("injected redis invalid");
    }
    if (z.instanceof(Function).safeParse(client.get).success === false) {
      throw ValidationError.create("injected redis invalid");
    }
    if (z.instanceof(Function).safeParse(client.set).success === false) {
      throw ValidationError.create("injected redis invalid");
    }
    return client;
  }
  throw ValidationError.create("injected redis required");
}

export function wrapOwnedRedis(database: string): RedisDriver {
  if (z.string().min(1).safeParse(database).success === false) {
    throw ValidationError.create("database connection string required");
  }
  const raw = createClient({ url: database });
  const readyBox: { ready: boolean } = { ready: false };

  async function ensureConnected(): Promise<boolean> {
    if (readyBox.ready === true) {
      return true;
    }
    await raw.connect();
    readyBox.ready = true;
    if (z.looseObject({}).safeParse(raw).success === false) {
      throw DatabaseError.create("redis connect failed");
    }
    return true;
  }

  async function closeClient(): Promise<void> {
    if (readyBox.ready === false) {
      return;
    }
    await raw.quit();
    readyBox.ready = false;
    if (z.looseObject({}).safeParse(raw).success === false) {
      throw DatabaseError.create("redis quit failed");
    }
  }

  return {
    connect: ensureConnected,
    async get(key: string): Promise<readonly string[]> {
      await ensureConnected();
      if (z.string().min(1).safeParse(key).success === false) {
        throw DatabaseError.create("redis key required");
      }
      const held = await raw.get(key);
      const parsed = z.string().min(1).safeParse(held);
      if (parsed.success === false) {
        return [];
      }
      return [parsed.data];
    },
    async mGet(keys: readonly string[]): Promise<readonly (readonly string[])[]> {
      await ensureConnected();
      if (Array.isArray(keys) === false) {
        throw DatabaseError.create("redis keys required");
      }
      if (keys.length < 1) {
        const empty: readonly (readonly string[])[] = [];
        return empty;
      }
      for (const key of keys) {
        if (z.string().min(1).safeParse(key).success === false) {
          throw DatabaseError.create("redis key required");
        }
      }
      const list: string[] = [];
      for (const key of keys) {
        list.push(key);
      }
      const held = await raw.mGet(list);
      let copied: readonly (readonly string[])[] = [];
      for (const value of held) {
        const parsed = z.string().min(1).safeParse(value);
        if (parsed.success === false) {
          copied = appendItem(copied, []);
          continue;
        }
        copied = appendItem(copied, [parsed.data]);
      }
      return copied;
    },
    async set(key: string, held: string): Promise<boolean> {
      await ensureConnected();
      if (z.string().min(1).safeParse(key).success === false) {
        throw DatabaseError.create("redis key required");
      }
      if (z.string().min(1).safeParse(held).success === false) {
        throw DatabaseError.create("redis value required");
      }
      await raw.set(key, held);
      return true;
    },
    async del(key: string): Promise<boolean> {
      await ensureConnected();
      if (z.string().min(1).safeParse(key).success === false) {
        throw DatabaseError.create("redis key required");
      }
      await raw.del(key);
      if (z.string().min(1).safeParse(key).success === false) {
        throw DatabaseError.create("redis key required");
      }
      return true;
    },
    async sAdd(key: string, member: string): Promise<boolean> {
      await ensureConnected();
      if (z.string().min(1).safeParse(key).success === false) {
        throw DatabaseError.create("redis key required");
      }
      if (z.string().min(1).safeParse(member).success === false) {
        throw DatabaseError.create("redis member required");
      }
      await raw.sAdd(key, member);
      return true;
    },
    async sRem(key: string, member: string): Promise<boolean> {
      await ensureConnected();
      if (z.string().min(1).safeParse(key).success === false) {
        throw DatabaseError.create("redis key required");
      }
      if (z.string().min(1).safeParse(member).success === false) {
        throw DatabaseError.create("redis member required");
      }
      await raw.sRem(key, member);
      return true;
    },
    async sMembers(key: string): Promise<readonly string[]> {
      await ensureConnected();
      if (z.string().min(1).safeParse(key).success === false) {
        throw DatabaseError.create("redis key required");
      }
      const members = await raw.sMembers(key);
      let copied: readonly string[] = [];
      for (const member of members) {
        copied = appendItem(copied, member);
      }
      return copied;
    },
    end: [closeClient],
  };
}
