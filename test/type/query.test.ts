import { describe, it, expect } from "vitest";
import { Model, Field, defaults, FookieError } from "../../src/exports";

@Model.Decorator({
    database: defaults.database.store,
    binds: {
        create: { role: [] },
        read: { role: [] },
    },
})
class QueryTypeModel extends Model {
    @Field.Decorator({ type: defaults.type.integer })
    intField!: number;

    @Field.Decorator({ type: defaults.type.float })
    floatField!: number;

    @Field.Decorator({ type: defaults.type.text })
    textField!: string;

    @Field.Decorator({ type: defaults.type.date })
    dateField!: string;

    @Field.Decorator({ type: defaults.type.time })
    timeField!: string;

    @Field.Decorator({ type: defaults.type.timestamp })
    timestampField!: string;
}

describe("QueryTypeModel CRUD Operations", () => {
    it("should create multiple entities", async () => {
        for (let i = 1; i <= 30; i++) {
            const entity = await QueryTypeModel.create({
                intField: i,
                floatField: i + 0.1,
                textField: `test${i}`,
                dateField: `2024-05-${i < 10 ? "0" + i : i}`,
                timeField: `14:${i < 10 ? "0" + i : i}:00`,
                timestampField: `2024-05-${i < 10 ? "0" + i : i}T14:${i < 10 ? "0" + i : i}:00Z`,
            });

            if (entity instanceof FookieError) {
                throw Error("QueryTypeModel creation error");
            }

            expect(entity instanceof QueryTypeModel).toBe(true);
            expect(entity.intField).toBe(i);
            expect(entity.floatField).toBe(i + 0.1);
            expect(entity.textField).toBe(`test${i}`);
            expect(entity.dateField).toBe(`2024-05-${i < 10 ? "0" + i : i}`);
            expect(entity.timeField).toBe(`14:${i < 10 ? "0" + i : i}:00`);
            expect(entity.timestampField).toBe(
                `2024-05-${i < 10 ? "0" + i : i}T14:${i < 10 ? "0" + i : i}:00Z`,
            );
        }
    });

    it("should read entities with individual filters", async () => {
        // Filter by integer greater than
        let results = await QueryTypeModel.read({
            filter: {
                intField: { gte: 15 },
            },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach((entity) => {
            expect((entity as QueryTypeModel).intField).toBeGreaterThanOrEqual(15);
        });

        // Filter by float less than
        results = await QueryTypeModel.read({
            filter: {
                floatField: { lte: 10.5 },
            },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach((entity) => {
            expect((entity as QueryTypeModel).floatField).toBeLessThanOrEqual(10.5);
        });

        // Filter by text equals
        results = await QueryTypeModel.read({
            filter: {
                textField: { equals: "test5" },
            },
        });
        expect(results.length).toBe(1);
        results.forEach((entity) => {
            expect((entity as QueryTypeModel).textField).toBe("test5");
        });

        // Filter by date greater than or equal
        results = await QueryTypeModel.read({
            filter: {
                dateField: { gte: "2024-05-10" },
            },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach((entity) => {
            expect(new Date((entity as QueryTypeModel).dateField).getTime()).toBeGreaterThanOrEqual(
                new Date("2024-05-10").getTime(),
            );
        });

        // Filter by time less than or equal
        results = await QueryTypeModel.read({
            filter: {
                timeField: { lte: "14:15:00" },
            },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach((entity) => {
            expect(
                new Date(`1970-01-01T${(entity as QueryTypeModel).timeField}Z`).getTime(),
            ).toBeLessThanOrEqual(new Date(`1970-01-01T14:15:00Z`).getTime());
        });

        // Filter by timestamp less than
        results = await QueryTypeModel.read({
            filter: {
                timestampField: { lt: "2024-05-20T14:20:00Z" },
            },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach((entity) => {
            expect(new Date((entity as QueryTypeModel).timestampField).getTime()).toBeLessThan(
                new Date("2024-05-20T14:20:00Z").getTime(),
            );
        });
    });

    it("should read entities with combined filters", async () => {
        const results = await QueryTypeModel.read({
            filter: {
                intField: { gte: 20 },
                floatField: { lte: 25.2 },
                textField: { equals: "test20" },
                dateField: { lt: "2024-05-30" },
                timeField: { gt: "13:00:00" },
                timestampField: { equals: "2024-05-20T14:20:00Z" },
            },
        });

        expect(results.length).toBe(1);
        const entity = results[0] as QueryTypeModel;
        expect(entity.intField).toBe(20);
        expect(entity.floatField).toBe(20.1);
        expect(entity.textField).toBe("test20");
        expect(entity.dateField).toBe("2024-05-20");
        expect(entity.timeField).toBe("14:20:00");
        expect(entity.timestampField).toBe("2024-05-20T14:20:00Z");
    });
});
