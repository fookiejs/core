import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import * as Fookie from "../index"

it("async effect", async function () {
    let flag = false
    const ls = Fookie.Builder.lifecycle(async function () {
        flag = true
    })

    const async_effect_model = await Fookie.Builder.model({
        name: "async_effect_model",
        database: Fookie.Dictionary.Database.store,
        schema: {
            field: {
                type: Fookie.Dictionary.Type.text,
            },
        },
        bind: {
            read: {
                effect: [ls],
            },
        },
    })

    await Fookie.run({
        model: async_effect_model,
        method: Fookie.Method.Read,
    })

    assert.equal(flag, true)
})
