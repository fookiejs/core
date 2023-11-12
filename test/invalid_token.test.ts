import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import * as Fookie from "../index"

it("async effect", async function () {
    const InvalidTokenModel = await Fookie.Builder.model({
        name: "InvalidTokenModel",
        database: Fookie.Dictionary.Database.store,
        schema: {
            name: { type: Fookie.Dictionary.Type.text, required: true },
            password: { type: Fookie.Dictionary.Type.text, required: true },
        },
    })

    const res = await Fookie.run({
        token: 1,
        model: InvalidTokenModel,
        method: Fookie.Method.Read,
    })

    assert.equal(res.status, false)
    assert.equal(res.error, "validate_payload")
})
