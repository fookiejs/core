import { z } from "zod";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { Done, Model, app } from "../src/index.ts";

const databaseUrl = process.env.FOOKIE_TEST_DATABASE ?? "";

const user = Model({
  name: "User",
  fields: {
    email: z.string().email().meta({ unique: true }),
    group: z.string().meta({ index: true }),
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
    async delete() {
      return Done;
    },
  },
});

const order = Model({
  name: "Order",
  fields: {
    user: user,
    limit: z.number().int(),
    desc: z.string(),
    check: z.boolean(),
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
    async delete() {
      return Done;
    },
  },
});

async function seedOrder(
  fookie: ReturnType<typeof app<readonly []>>,
  buyerId: string,
  size: number,
): Promise<string> {
  const queued = await fookie.create(order, {
    user: buyerId,
    limit: size,
    desc: `order of ${String(size)}`,
    check: false,
  });
  return queued.signal;
}

describe("reserved words", { skip: databaseUrl.length === 0 }, () => {
  let pool: pg.Pool;

  before(() => {
    pool = new pg.Pool({ connectionString: databaseUrl, max: 4 });
  });

  after(async () => {
    await pool.end();
  });

  function boot() {
    return app({
      listen: "0",
      database: databaseUrl,
      models: [user, order],
      externals: [] as const,
      onExternalEvent: async () => {},
      pool: [
        {
          query: (sql: string, params?: unknown[]) => pool.query(sql, params),
          connect: () => pool.connect(),
          end: [],
        },
      ],
    });
  }

  it("serves a model named after a reserved word", async () => {
    const fookie = boot();
    const buyer = await fookie.create(user, {
      email: `a${String(Date.now())}@b.com`,
      group: "vip",
    });
    assert.equal(buyer.signal, "done", "a table named user must be creatable");
    if (buyer.signal !== "done") {
      throw new Error("user row required");
    }

    const placed = await fookie.create(order, {
      user: buyer.id,
      limit: 3,
      desc: "two reserved columns and a relation",
      check: true,
    });
    assert.equal(placed.signal, "done", "a table named order must be creatable");
    if (placed.signal !== "done") {
      throw new Error("order row required");
    }

    await fookie.stop();
  });

  it("filters, orders and pages on reserved column names", async () => {
    const fookie = boot();
    const buyer = await fookie.create(user, {
      email: `c${String(Date.now())}@d.com`,
      group: "vip",
    });
    if (buyer.signal !== "done") {
      throw new Error("user row required");
    }
    for (const size of [1, 2, 3]) {
      const seeded = await seedOrder(fookie, buyer.id, size);
      assert.equal(seeded, "done");
    }

    const listed = await fookie.list(
      order,
      { user: { eq: buyer.id }, limit: { gte: 2 } },
      { limit: [2], offset: [0], order: [{ field: "limit", direction: "desc" }] },
    );
    assert.equal(listed.signal, "done");
    assert.equal(listed.results.length, 2, "paging must survive a column named limit");
    for (const row of listed.results.slice(0, 1)) {
      assert.equal(row.limit, 3, "ordering must survive a column named limit");
    }

    await fookie.stop();
  });

  it("builds the foreign key between two reserved table names", async () => {
    const fookie = boot();
    await fookie.list(user, {});
    const constraints = await pool.query(
      `SELECT conname FROM pg_constraint WHERE conrelid = 'public."order"'::regclass AND contype = 'f'`,
    );
    assert.ok(
      constraints.rows.some((row) => String(row.conname) === "order_user_fk"),
      "the relation column must still carry its foreign key",
    );

    await fookie.stop();
  });
});
