import { z } from "zod";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Done, Model, app } from "../src/index.ts";
import { MockDb } from "./mock-db.ts";
import { Postgres } from "./engines.ts";

const passthrough = {
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
};

const item = Model({
  name: "CraftItem",
  fields: { title: z.string().meta({ unique: true }), tier: z.number().int() },
  flow: passthrough,
});

const recipe = Model({
  name: "CraftRecipe",
  fields: { produces: item, station: z.string() },
  flow: passthrough,
});

const recipeInput = Model({
  name: "CraftRecipeInput",
  fields: { belongsTo: recipe, consumes: item, quantity: z.number().int() },
  flow: passthrough,
});

function selectsOn(queries: readonly string[], table: string): number {
  let total = 0;
  for (const sql of queries) {
    if (sql.startsWith("SELECT") && sql.includes(table)) {
      total = total + 1;
    }
  }
  return total;
}

async function world(): Promise<{ db: MockDb; fookie: ReturnType<typeof app> }> {
  const db = new MockDb();
  const fookie = app({
    listen: "0",
    database: Postgres("postgres://mock", [db]),
    models: [item, recipe, recipeInput],
    externals: [] as const,
    onExternalEvent: async () => undefined,
  });
  await fookie.ready();
  return { db, fookie };
}

describe("a world that grows by rows rather than by models", () => {
  it("does not pay a query per row when listing a table full of relations", async () => {
    const { db, fookie } = await world();

    const produced = await fookie.create(item, { title: "warp-core", tier: 9 });
    assert.equal(produced.signal, Done);
    if (produced.signal !== Done) {
      return;
    }
    const built = await fookie.create(recipe, { produces: produced.id, station: "assembler" });
    assert.equal(built.signal, Done);
    if (built.signal !== Done) {
      return;
    }

    const rows = 100;
    for (let at = 0; at < rows; at += 1) {
      const ingredient = await fookie.create(item, { title: `ore-${at}`, tier: 1 });
      if (ingredient.signal !== Done) {
        assert.fail(`seeding ingredient ${at} failed`);
        return;
      }
      const line = await fookie.create(recipeInput, {
        belongsTo: built.id,
        consumes: ingredient.id,
        quantity: at + 1,
      });
      if (line.signal !== Done) {
        assert.fail(`seeding recipe input ${at} failed`);
        return;
      }
    }

    db.queries.length = 0;
    const listed = await fookie.list(recipeInput, {});
    assert.equal(listed.signal, Done, "listing the inputs must succeed");

    assert.equal(
      selectsOn(db.queries, "craft_recipe_input"),
      1,
      `listing ${rows} rows is one select, not one per row`,
    );
    assert.equal(
      selectsOn(db.queries, "craft_item"),
      0,
      "core hands back foreign keys rather than walking them, so a listing never fans out",
    );

    await fookie.stop();
  });

  it("costs no reads at all to create a row however many relations it carries", async () => {
    const { db, fookie } = await world();

    const produced = await fookie.create(item, { title: "ion-drive", tier: 7 });
    if (produced.signal !== Done) {
      assert.fail("seed item failed");
      return;
    }
    const built = await fookie.create(recipe, { produces: produced.id, station: "assembler" });
    if (built.signal !== Done) {
      assert.fail("seed recipe failed");
      return;
    }
    const ingredient = await fookie.create(item, { title: "steel-plate", tier: 3 });
    if (ingredient.signal !== Done) {
      assert.fail("seed ingredient failed");
      return;
    }

    db.queries.length = 0;
    const line = await fookie.create(recipeInput, {
      belongsTo: built.id,
      consumes: ingredient.id,
      quantity: 4,
    });
    assert.equal(line.signal, Done);

    assert.equal(
      selectsOn(db.queries, "craft_"),
      0,
      `two relations must cost no reads at all — referential integrity is the database's foreign key, not a read-then-write check: ${db.queries.filter((q) => q.startsWith("SELECT")).join(" | ")}`,
    );

    await fookie.stop();
  });
});
