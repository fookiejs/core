import { expect, test } from "vitest";
import { Model, Field, defaults } from "../../src/exports.ts";
import { FookieError } from "../../src/core/error.ts";

test("Define a field with a default value", async () => {
    @Model.Decorator({
        database: defaults.database.store,
    })
    class DefaultFieldModel extends Model {
        @Field.Decorator({ type: defaults.type.text, default: "defaultVal" })
        myField?: string;
    }

    const response = await DefaultFieldModel.create({});
    expect(response instanceof DefaultFieldModel).toBe(true);
    if (response instanceof DefaultFieldModel) {
        expect(response.myField === "defaultVal").toBe(true);
    }
});
