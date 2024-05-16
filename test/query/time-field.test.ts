import { describe, it, expect } from "vitest";
import { Model, Field, defaults } from "../../src/exports";
import { FookieError } from "../../src/core/error";

describe("QueryTimeModel Query Tests", async () => {
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
    class QueryTimeModel extends Model {
        @Field.Decorator({ type: defaults.type.time })
        timeField!: string;
    }

    await QueryTimeModel.create({ timeField: "13:00:00" });
    await QueryTimeModel.create({ timeField: "14:00:00" });
    await QueryTimeModel.create({ timeField: "15:00:00" });

    it("equals query", async () => {
        const results = await QueryTimeModel.read({
            filter: {
                timeField: { equals: "13:00:00" },
            },
        });
        expect(results).toHaveLength(1);
        expect(results[0].timeField).toBe("13:00:00");
    });

    it("notEquals query", async () => {
        const results = await QueryTimeModel.read({
            filter: {
                timeField: { notEquals: "13:00:00" },
            },
        });
        expect(results).toHaveLength(2);
        expect(results[0].timeField).not.toBe("13:00:00");
    });

    it("in query", async () => {
        const results = await QueryTimeModel.read({
            filter: {
                timeField: { in: ["13:00:00", "14:00:00"] },
            },
        });
        expect(results).toHaveLength(2);
        expect(results.map((r) => r.timeField)).toEqual(
            expect.arrayContaining(["13:00:00", "14:00:00"]),
        );
    });

    it("notIn query", async () => {
        const results = await QueryTimeModel.read({
            filter: {
                timeField: { notIn: ["13:00:00", "14:00:00"] },
            },
        });
        expect(results).toHaveLength(1);
        expect(results[0].timeField).toBe("15:00:00");
    });

    it("gte query", async () => {
        const results = await QueryTimeModel.read({
            filter: {
                timeField: { gte: "14:00:00" },
            },
        });

        expect(results).toHaveLength(2);
        expect(results.map((r) => r.timeField)).toEqual(
            expect.arrayContaining(["14:00:00", "15:00:00"]),
        );
    });

    it("gt query", async () => {
        const results = await QueryTimeModel.read({
            filter: {
                timeField: { gt: "14:00:00" },
            },
        });
        expect(results).toHaveLength(1);
        expect(results[0].timeField).toBe("15:00:00");
    });

    it("lte query", async () => {
        const results = await QueryTimeModel.read({
            filter: {
                timeField: { lte: "14:00:00" },
            },
        });
        expect(results).toHaveLength(2);
        expect(results.map((r) => r.timeField)).toEqual(
            expect.arrayContaining(["13:00:00", "14:00:00"]),
        );
    });

    it("lt query", async () => {
        const results = await QueryTimeModel.read({
            filter: {
                timeField: { lt: "14:00:00" },
            },
        });
        expect(results).toHaveLength(1);
        expect(results[0].timeField).toBe("13:00:00");
    });

    it("isNull query", async () => {
        const results = await QueryTimeModel.read({
            filter: {
                timeField: { isNull: true },
            },
        });
        expect(results).toHaveLength(0);
    });

    it("isNotNull query", async () => {
        const results = await QueryTimeModel.read({
            filter: {
                timeField: { isNull: false },
            },
        });
        expect(results).toHaveLength(3);
    });

    it("between query", async () => {
        const results = await QueryTimeModel.read({
            filter: {
                timeField: { gte: "13:00:00", lte: "14:00:00" },
            },
        });
        expect(results).toHaveLength(2);
        expect(results.map((r) => r.timeField)).toEqual(
            expect.arrayContaining(["13:00:00", "14:00:00"]),
        );
    });

    it("notExist query", async () => {
        const results = await QueryTimeModel.read({
            filter: {
                timeField: { notExist: false },
            },
        });
        expect(results instanceof FookieError).toBeTruthy();
    });
});
