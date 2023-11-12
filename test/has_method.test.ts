import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import * as Fookie from "../index"

it("async effect", async function () {
    const HasMethodModel = await Fookie.Builder.model({
        name: "HasMethodModel",
        database: Fookie.Dictionary.Database.store,
        schema: {
            name: { type: Fookie.Dictionary.Type.text, required: true },
            password: { type: Fookie.Dictionary.Type.text, required: true },
        },
    })

    const res = await Fookie.run({
        model: HasMethodModel,
        method: "invalid_method",
    })
    assert.equal(res.status, false)
    assert.equal(res.error, "has_method")
})
