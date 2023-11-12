import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import * as Fookie from "../index"

it("Count return value must be number", async function () {
    const ModelToCount = await Fookie.Builder.model({
        name: "ModelToCount",
        database: Fookie.Dictionary.Database.store,
        schema: {
            name: { type: Fookie.Dictionary.Type.text, required: true },
            password: { type: Fookie.Dictionary.Type.text, required: true },
        },
    })

    let res = await Fookie.run({
        token: process.env.SYSTEM_TOKEN,
        model: ModelToCount,
        method: Fookie.Method.Count,
    })
    assert.equal(typeof res.data, "number")
})
