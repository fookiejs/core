import { describe, it, expect } from "vitest";
import { Model, Field, defaults } from "../../src/exports";

describe("QueryIntModel Query Tests", async () => {
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
    class QueryIntModel extends Model {
        @Field.Decorator({ type: defaults.type.integer })
        intField!: number;
    }

    await QueryIntModel.create({ intField: 1 });
    await QueryIntModel.create({ intField: 2 });
    await QueryIntModel.create({ intField: 3 });

    it("equals query", async () => {
        const results = await QueryIntModel.read({
            filter: {
                intField: { equals: 1 },
            },
        });
        expect(results).toHaveLength(1);
        expect(results[0].intField).toBe(1);
    });

    it("notEquals query", async () => {
        const results = await QueryIntModel.read({
            filter: {
                intField: { notEquals: 1 },
            },
        });
        expect(results).toHaveLength(2);
        expect(results[0].intField).not.toBe(1);
    });

    it("in query", async () => {
        const results = await QueryIntModel.read({
            filter: {
                intField: { in: [1, 2] },
            },
        });
        expect(results).toHaveLength(2);
        expect(results.map((r) => r.intField)).toEqual(expect.arrayContaining([1, 2]));
    });

    it("notIn query", async () => {
        const results = await QueryIntModel.read({
            filter: {
                intField: { notIn: [1, 2] },
            },
        });
        expect(results).toHaveLength(1);
        expect(results[0].intField).toBe(3);
    });

    it("gte query", async () => {
        const results = await QueryIntModel.read({
            filter: {
                intField: { gte: 2 },
            },
        });
        expect(results).toHaveLength(2);
        expect(results.map((r) => r.intField)).toEqual(expect.arrayContaining([2, 3]));
    });

    it("gt query", async () => {
        const results = await QueryIntModel.read({
            filter: {
                intField: { gt: 2 },
            },
        });
        expect(results).toHaveLength(1);
        expect(results[0].intField).toBe(3);
    });

    it("lte query", async () => {
        const results = await QueryIntModel.read({
            filter: {
                intField: { lte: 2 },
            },
        });
        expect(results).toHaveLength(2);
        expect(results.map((r) => r.intField)).toEqual(expect.arrayContaining([1, 2]));
    });

    it("lt query", async () => {
        const results = await QueryIntModel.read({
            filter: {
                intField: { lt: 2 },
            },
        });
        expect(results).toHaveLength(1);
        expect(results[0].intField).toBe(1);
    });

    it("isNull query", async () => {
        const results = await QueryIntModel.read({
            filter: {
                intField: { isNull: true },
            },
        });
        expect(results).toHaveLength(0);
    });

    it("isNull query", async () => {
        const results = await QueryIntModel.read({
            filter: {
                intField: { isNull: true },
            },
        });
        expect(results).toHaveLength(0);
    });

    it("isNotNull query", async () => {
        const results = await QueryIntModel.read({
            filter: {
                intField: { isNull: false },
            },
        });
        expect(results).toHaveLength(3);
    });
});
