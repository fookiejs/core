import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import * as Fookie from "../index"

it("valid body", async function () {
    const has_body_model = await Fookie.Builder.model({
        name: "has_body_model",
        database: Fookie.Dictionary.Database.store,
        schema: {
            field: {
                type: Fookie.Dictionary.Type.text,
                required: true,
            },
        },
    })

    const res = await Fookie.run({
        model: has_body_model,
        method: Fookie.Method.Create,
        body: 1,
    })

    assert.equal(res.status, false)
    assert.equal(res.error, "validate_payload")
})
