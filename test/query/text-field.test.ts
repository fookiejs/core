import { describe, it, expect } from "vitest";
import { Model, Field, defaults } from "../../src/exports";
import { FookieError } from "../../src/core/error";

// Testler
describe("QueryTextModel Query Tests", async () => {
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
    class QueryTextModel extends Model {
        @Field.Decorator({ type: defaults.type.text })
        textField!: string;
    }

    await QueryTextModel.create({ textField: "abc" });
    await QueryTextModel.create({ textField: "def" });
    await QueryTextModel.create({ textField: "ghi" });

    it("equals query", async () => {
        const results = await QueryTextModel.read({
            filter: {
                textField: { equals: "abc" },
            },
        });
        expect(results).toHaveLength(1);
        expect(results[0].textField).toBe("abc");
    });

    it("notEquals query", async () => {
        const results = await QueryTextModel.read({
            filter: {
                textField: { notEquals: "abc" },
            },
        });
        expect(results).toHaveLength(2);
        expect(results[0].textField).not.toBe("abc");
    });

    it("in query", async () => {
        const results = await QueryTextModel.read({
            filter: {
                textField: { in: ["abc", "def"] },
            },
        });
        expect(results).toHaveLength(2);
        expect(results.map((r) => r.textField)).toEqual(expect.arrayContaining(["abc", "def"]));
    });

    it("notIn query", async () => {
        const results = await QueryTextModel.read({
            filter: {
                textField: { notIn: ["abc", "def"] },
            },
        });
        expect(results).toHaveLength(1);
        expect(results[0].textField).toBe("ghi");
    });

    it("like query", async () => {
        const results = await QueryTextModel.read({
            filter: {
                textField: { like: "%a%" },
            },
        });
        expect(results).toHaveLength(1);
        expect(results[0].textField).toBe("abc");
    });

    it("isNull query", async () => {
        const results = await QueryTextModel.read({
            filter: {
                textField: { isNull: true },
            },
        });

        expect(results).toHaveLength(0);
    });

    it("isNotNull query", async () => {
        const results = await QueryTextModel.read({
            filter: {
                textField: { isNull: false },
            },
        });
        expect(results).toHaveLength(3);
    });

    it("notExist query", async () => {
        const results = await QueryTextModel.read({
            filter: {
                textField: { notExist: false },
            },
        });
        expect(results instanceof FookieError).toBeTruthy();
    });
});
