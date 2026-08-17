import { Done, Model, app } from "@fookiejs/core";
import { Postgres } from "@fookiejs/postgresql";
import { Redis } from "@fookiejs/redis";
import { z } from "zod";
import { worldSize } from "./world.ts";

export const databaseUrl =
  process.env.DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:5433/fookie_demo";
const redisUrl = process.env.REDIS_URL ?? "redis://127.0.0.1:6381";

export type BeadSeed = {
  x: number;
  y: number;
  shape: "round" | "square";
  size: number;
  hue: number;
  light: number;
};

export function randomBead(): BeadSeed {
  return {
    x: Math.random() * worldSize,
    y: Math.random() * worldSize,
    shape: Math.random() < 0.5 ? "round" : "square",
    size: 4 + Math.random() * 8,
    hue: Math.random() * 360,
    light: 0.35 + Math.random() * 0.5,
  };
}

export const bead = Model({
  name: "Bead",
  database: Redis(redisUrl),
  fields: {
    x: z.number(),
    y: z.number(),
    shape: z.enum(["round", "square"]),
    size: z.number().positive(),
    hue: z.number(),
    light: z.number(),
  },
  flow: {
    async create() {
      return Done;
    },
    async list() {
      return Done;
    },
    async update() {
      return Done;
    },
    async delete(flow) {
      const spawned = await flow.create(bead, randomBead());
      if (spawned.signal !== Done) {
        return spawned.signal;
      }
      return Done;
    },
  },
});

export function createFookie() {
  return app({
    listen: "0",
    database: Postgres(databaseUrl),
    models: [bead],
    externals: [] as const,
    onExternalEvent: async () => undefined,
  });
}
