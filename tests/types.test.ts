import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Types, models, Model, flows, Done } from "../src/index.ts";

describe("types and helpers", () => {
  it("exposes postgres-aligned scalar types", () => {
    assert.equal(Types.string.kind, "text");
    assert.equal(Types.int.kind, "integer");
    assert.equal(Types.bigint.kind, "bigint");
    assert.equal(Types.float.kind, "real");
    assert.equal(Types.bool.kind, "boolean");
    assert.equal(Types.uuid.kind, "uuid");
    assert.equal(Types.json.kind, "json");
    assert.equal(Types.jsonb.kind, "jsonb");
    assert.equal(Types.bytea.kind, "bytea");
    assert.equal(Types.point.kind, "point");
    assert.equal(Types.coordinate.kind, "point");
    assert.equal(Types.currency.kind, "currency");
    assert.equal(Types.email.kind, "email");
    assert.equal(Types.url.kind, "url");
  });

  it("chains type modifiers", () => {
    const field = Types.float.min(0).max(5).unique().index();
    assert.equal(field.meta.unique, true);
    assert.equal(field.meta.index, true);
    assert.equal(field.meta.max, 5);
    assert.equal(Types.char(3).kind, "char(3)");
    assert.equal(Types.varchar(64).kind, "varchar(64)");
    assert.equal(Types.enum("a", "b", "c").kind, "enum");
    assert.equal(Types.relation({ name: "Parent" }).kind, "relation:Parent");
  });

  it("registers models via models helper", () => {
    const a = Model({
      name: "A",
      fields: { title: Types.string },
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
    const b = Model({
      name: "B",
      fields: { title: Types.string },
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
    const list = models([a, b]);
    assert.equal(list.length, 2);
    assert.equal(list[0]?.name, "A");
    assert.equal(list[1]?.name, "B");
  });
});
