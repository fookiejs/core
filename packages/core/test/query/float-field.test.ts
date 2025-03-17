import { Model, Field, defaults, FookieError } from "@fookiejs/core";
import { expect } from "jsr:@std/expect";

Deno.test("QueryFloatModel Query Tests", async () => {
  @Model.Decorator({
    database: defaults.database.store,
    binds: {
      read: {
        role: [],
      },
      create: {
        role: [],
      },
    },
  })
  class QueryFloatModel extends Model {
    @Field.Decorator({ type: defaults.type.number })
    floatField!: number;
  }

  await QueryFloatModel.create({ floatField: 1.1 });
  await QueryFloatModel.create({ floatField: 2.2 });
  await QueryFloatModel.create({ floatField: 3.3 });

  Deno.test("equals query", async () => {
    const results = await QueryFloatModel.read({
      filter: {
        floatField: { equals: 1.1 },
      },
    });
    expect(results).toHaveLength(1);
    expect(results[0].floatField).toBe(1.1);
  });

  Deno.test("notEquals query", async () => {
    const results = await QueryFloatModel.read({
      filter: {
        floatField: { notEquals: 1.1 },
      },
    });
    expect(results).toHaveLength(2);
    expect(results[0].floatField).not.toBe(1.1);
  });

  Deno.test("in query", async () => {
    const results = await QueryFloatModel.read({
      filter: {
        floatField: { in: [1.1, 2.2] },
      },
    });
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.floatField)).toEqual(
      expect.arrayContaining([1.1, 2.2])
    );
  });

  Deno.test("notIn query", async () => {
    const results = await QueryFloatModel.read({
      filter: {
        floatField: { notIn: [1.1, 2.2] },
      },
    });
    expect(results).toHaveLength(1);
    expect(results[0].floatField).toBe(3.3);
  });

  Deno.test("gte query", async () => {
    const results = await QueryFloatModel.read({
      filter: {
        floatField: { gte: 2.2 },
      },
    });
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.floatField)).toEqual(
      expect.arrayContaining([2.2, 3.3])
    );
  });

  Deno.test("gt query", async () => {
    const results = await QueryFloatModel.read({
      filter: {
        floatField: { gt: 2.2 },
      },
    });
    expect(results).toHaveLength(1);
    expect(results[0].floatField).toBe(3.3);
  });

  Deno.test("lte query", async () => {
    const results = await QueryFloatModel.read({
      filter: {
        floatField: { lte: 2.2 },
      },
    });
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.floatField)).toEqual(
      expect.arrayContaining([1.1, 2.2])
    );
  });

  Deno.test("lt query", async () => {
    const results = await QueryFloatModel.read({
      filter: {
        floatField: { lt: 2.2 },
      },
    });
    expect(results).toHaveLength(1);
    expect(results[0].floatField).toBe(1.1);
  });

  Deno.test("isNull query", async () => {
    const results = await QueryFloatModel.read({
      filter: {
        floatField: { isNull: true },
      },
    });
    expect(results).toHaveLength(0);
  });

  Deno.test("isNotNull query", async () => {
    const results = await QueryFloatModel.read({
      filter: {
        floatField: { isNull: false },
      },
    });
    expect(results).toHaveLength(3);
  });

  Deno.test("notExist query", async () => {
    const results = await QueryFloatModel.read({
      filter: {
        floatField: { notExist: false },
      },
    });
    expect(results instanceof FookieError).toBeTruthy();
  });
});
