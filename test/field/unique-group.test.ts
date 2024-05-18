import { expect, test } from "vitest";
import { Model, Field, defaults, FookieError } from "../../src/exports.ts";

test("Define a unique group field with Error", async () => {
    @Model.Decorator({
        database: defaults.database.store,
        binds: {
            create: { role: [] },
        },
    })
    class UniqueGroupField extends Model {
        @Field.Decorator({ uniqueGroup: ["groupId", "itemName"], type: defaults.type.text })
        itemName?: string;

        @Field.Decorator({ type: defaults.type.text })
        groupId?: string;
    }

    const groupId = "group1";

    const firstResponse = await UniqueGroupField.create({
        groupId,
        itemName: "item1",
    });

    expect(firstResponse instanceof UniqueGroupField).toBe(true);

    const secondResponse = await UniqueGroupField.create({
        groupId,
        itemName: "item1",
    });

    expect(secondResponse instanceof FookieError).toBe(true);
    if (secondResponse instanceof FookieError) {
        expect(secondResponse.key === "uniqueGroup").toBe(true);
    }
});
