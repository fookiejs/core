import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";

const poolConfigs: { connectionString: string }[] = [];
let lastPool: PoolMock | false = false;

class PoolMock {
  ended = false;
  query = async () => ({ rows: [], rowCount: 0 });
  connect = async () => ({ query: this.query, release: () => true });
  end = async () => {
    this.ended = true;
  };
  constructor(config: { connectionString: string }) {
    poolConfigs.push(config);
    lastPool = this;
  }
}

mock.module("pg", { exports: { default: { Pool: PoolMock } } });

const { app, Model, Types, flows, Done } = await import("../src/index.ts");

describe("default pg pool", () => {
  it("uses pg.Pool when pool config is omitted", () => {
    const user = Model({
      name: "PoolDefault",
      fields: { email: Types.email },
      flow: flows({
        async create() {
          return Done;
        },
        async list() {
          return Done;
        },
        async update() {
          return Done;
        },
        async delete() {
          return Done;
        },
      }),
    });

    app({
      listen: "0",
      database: "postgres://default-pool",
      models: [user],
      externals: [],
      onExternalEvent: async () => {},
    });

    assert.deepEqual(poolConfigs[0], { connectionString: "postgres://default-pool" });
  });

  it("ends the default pool on stop", async () => {
    const user = Model({
      name: "PoolStop",
      fields: { email: Types.email },
      flow: flows({
        create: async () => Done,
        list: async () => Done,
        update: async () => Done,
        delete: async () => Done,
      }),
    });

    const fookie = app({
      listen: "0",
      database: "postgres://default-pool-stop",
      models: [user],
      externals: [],
      onExternalEvent: async () => {},
    });

    fookie.run();
    assert.equal(await fookie.stop(), true);
    assert.equal(lastPool !== false && lastPool.ended, true);
  });
});
