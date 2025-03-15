import { expect, test } from "vitest"
import { Model, Field, defaults, FookieError, Required } from "@fookiejs/core"

test("Define a required field with Error", async () => {
    @Model.Decorator({
        database: defaults.database.store,
        binds: { create: { role: [] } },
    })
    class RequiredField extends Model {
        @Field.Decorator({ features: [Required], type: defaults.type.string })
        field?: string
    }

    const response = await RequiredField.create({})
    expect(response instanceof FookieError).toBe(true)
    if (response instanceof FookieError) {
        expect(response.key === "check_required").toBe(true)
    }
})

test("Define a required field with Success", async () => {
    @Model.Decorator({
        database: defaults.database.store,
        binds: { create: { role: [] } },
    })
    class RequiredField2 extends Model {
        @Field.Decorator({ features: [Required], type: defaults.type.string })
        field: string
    }

    const response = await RequiredField2.create({
        field: "fookie",
    })
    expect(response instanceof RequiredField2).toBe(true)
    if (response instanceof RequiredField2) {
        expect(response.field === "fookie").toBe(true)
    }
})
