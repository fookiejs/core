import { expect, test } from "vitest"
import { Model, Field, defaults, FookieError } from "../../src/exports"

test("Define a field with a default value", async () => {
    @Model.Decorator({
        database: defaults.database.store,
        binds: {
            create: {
                role: [],
            },
        },
    })
    class DefaultFieldModel extends Model {
        @Field.Decorator({ type: defaults.type.text, default: "defaultVal" })
        myField?: string
    }

    const response = await DefaultFieldModel.create({})
    expect(response instanceof DefaultFieldModel).toBe(true)
    if (response instanceof DefaultFieldModel) {
        expect(response.myField === "defaultVal").toBe(true)
    }
})
