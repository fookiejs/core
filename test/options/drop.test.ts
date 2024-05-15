import { describe, it, expect } from "vitest";
import { Config, Field, LifecycleFunction, Model, defaults } from "../../src/exports";
import { v4 } from "uuid";

import { system } from "../../src/defaults/role/system";

describe("Relation", () => {
    @Model.Decorator({
        database: defaults.database.store,
        binds: {
            delete: {
                role: [system],
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
});
