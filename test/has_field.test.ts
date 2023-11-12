import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import * as Fookie from "../index"

it("Has field", async function () {
    const has_field_model = await Fookie.Builder.model({
        name: "hf_model",
        database: Fookie.Dictionary.Database.store,
        schema: {
            field: {
                type: Fookie.Dictionary.Type.text,
                required: true,
            },
        },
        bind: {
            test: {},
            create: {},
            delete: {},
            read: {},
            count: {},
        },
    })

    const res = await Fookie.run({
        model: has_field_model,
        method: Fookie.Method.Create,
        body: {
            abc: "hello",
        },
    })

    assert.equal(res.status, false)
    assert.equal(res.error, "has_field")
})
