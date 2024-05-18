import { describe, it, expect } from "vitest";
import { Field, Model, defaults } from "../../src/exports";
import { v4 } from "uuid";

describe("Relation", () => {
    @Model.Decorator({
        database: defaults.database.store,
        binds: {
            delete: {
                role: [],
            },
            read: {
                role: [],
            },
            create: {
                role: [],
            },
        },
    })
    class Drop extends Model {
        @Field.Decorator({ type: defaults.type.text })
        name: string;
    }

    it("Drop an entity after creation", async () => {
        const entity = await Drop.create(
            { name: v4() },
            {
                drop: 0,
            },
        );

        expect(entity instanceof Drop).toBe(true);

        const entities = await Drop.read();

        expect(entities.length).toBe(0);
    });

    it("Drop an entity after a delay", async () => {
        const entity = await Drop.create(
            { name: v4() },
            {
                drop: 10,
            },
        );

        expect(entity instanceof Drop).toBe(true);

        let entities = await Drop.read();
        expect(entities.length).toBe(1);

        await new Promise((resolve) => setTimeout(resolve, 1000));
        entities = await Drop.read();
        expect(entities.length).toBe(0);
    });
});
