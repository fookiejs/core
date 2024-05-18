import { describe, it, expect } from "vitest";
import { Model, Field, defaults } from "../../src/exports";
import { FookieError } from "../../src/core/error";

describe("QueryTimestampModel Query Tests", async () => {
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
    class QueryTimestampModel extends Model {
        @Field.Decorator({ type: defaults.type.timestamp })
        timestampField: string | null;
    }

    await QueryTimestampModel.create({ timestampField: "2024-05-14T10:00:00Z" });
    await QueryTimestampModel.create({ timestampField: "2024-05-15T12:00:00Z" });
    await QueryTimestampModel.create({ timestampField: "2024-05-16T14:00:00Z" });

    it("equals query", async () => {
        const results = await QueryTimestampModel.read({
            filter: {
                timestampField: { equals: "2024-05-14T10:00:00Z" },
            },
        });
        expect(results).toHaveLength(1);
        expect(results[0].timestampField).toBe("2024-05-14T10:00:00Z");
    });

    it("notEquals query", async () => {
        const results = await QueryTimestampModel.read({
            filter: {
                timestampField: { notEquals: "2024-05-14T10:00:00Z" },
            },
        });
        expect(results).toHaveLength(2);
        expect(results[0].timestampField).not.toBe("2024-05-14T10:00:00Z");
    });

    it("in query", async () => {
        const results = await QueryTimestampModel.read({
            filter: {
                timestampField: { in: ["2024-05-14T10:00:00Z", "2024-05-15T12:00:00Z"] },
            },
        });
        expect(results).toHaveLength(2);
        expect(results.map((r) => r.timestampField)).toEqual(
            expect.arrayContaining(["2024-05-14T10:00:00Z", "2024-05-15T12:00:00Z"]),
        );
    });

    it("notIn query", async () => {
        const results = await QueryTimestampModel.read({
            filter: {
                timestampField: { notIn: ["2024-05-14T10:00:00Z", "2024-05-15T12:00:00Z"] },
            },
        });
        expect(results).toHaveLength(1);
        expect(results[0].timestampField).toBe("2024-05-16T14:00:00Z");
    });

    it("gte query", async () => {
        const results = await QueryTimestampModel.read({
            filter: {
                timestampField: { gte: "2024-05-15T12:00:00Z" },
            },
        });
        expect(results).toHaveLength(2);
        expect(results.map((r) => r.timestampField)).toEqual(
            expect.arrayContaining(["2024-05-15T12:00:00Z", "2024-05-16T14:00:00Z"]),
        );
    });

    it("gt query", async () => {
        const results = await QueryTimestampModel.read({
            filter: {
                timestampField: { gt: "2024-05-15T12:00:00Z" },
            },
        });
        expect(results).toHaveLength(1);
        expect(results[0].timestampField).toBe("2024-05-16T14:00:00Z");
    });

    it("lte query", async () => {
        const results = await QueryTimestampModel.read({
            filter: {
                timestampField: { lte: "2024-05-15T12:00:00Z" },
            },
        });
        expect(results).toHaveLength(2);
        expect(results.map((r) => r.timestampField)).toEqual(
            expect.arrayContaining(["2024-05-14T10:00:00Z", "2024-05-15T12:00:00Z"]),
        );
    });

    it("lt query", async () => {
        const results = await QueryTimestampModel.read({
            filter: {
                timestampField: { lt: "2024-05-15T12:00:00Z" },
            },
        });
        expect(results).toHaveLength(1);
        expect(results[0].timestampField).toBe("2024-05-14T10:00:00Z");
    });

    it("isNull query", async () => {
        const results = await QueryTimestampModel.read({
            filter: {
                timestampField: { isNull: true },
            },
        });
        expect(results).toHaveLength(0);
    });

    it("isNotNull query", async () => {
        const results = await QueryTimestampModel.read({
            filter: {
                timestampField: { isNull: false },
            },
        });
        expect(results).toHaveLength(3);
    });

    it("between query", async () => {
        const results = await QueryTimestampModel.read({
            filter: {
                timestampField: { gte: "2024-05-14T10:00:00Z", lte: "2024-05-15T12:00:00Z" },
            },
        });
        expect(results).toHaveLength(2);
        expect(results.map((r) => r.timestampField)).toEqual(
            expect.arrayContaining(["2024-05-14T10:00:00Z", "2024-05-15T12:00:00Z"]),
        );
    });

    it("notExist query", async () => {
        const results = await QueryTimestampModel.read({
            filter: {
                timestampField: { notExist: false },
            },
        });
        expect(results instanceof FookieError).toBeTruthy();
    });

    it("isNull query", async () => {
        await QueryTimestampModel.create({ timestampField: null });

        const results = await QueryTimestampModel.read({
            filter: {
                timestampField: { isNull: false },
            },
        });
        expect(results.length).toBe(3);
    });
});
