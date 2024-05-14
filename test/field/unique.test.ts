import { expect, test } from "vitest";
import { Model, Field, defaults } from "../../src/exports.ts";
import { FookieError } from "../../src/core/error.ts";

test("Define a unique field with Error", async () => {
    @Model.Decorator({
        database: defaults.database.store,
    })
    class UniqueField extends Model {
        @Field.Decorator({ unique: true, type: defaults.type.text })
        username: string;
    }

    const firstResponse = await UniqueField.create({
        username: "uniqueUser",
    });
    expect(firstResponse instanceof UniqueField).toBe(true);

    const secondResponse = await UniqueField.create({
        username: "uniqueUser",
    });

    expect(secondResponse instanceof FookieError).toBe(true);
    if (secondResponse instanceof FookieError) {
        expect(secondResponse.key === "unique").toBe(true);
    }
});