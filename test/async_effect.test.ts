import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, lifecycle, mixin } from "../packages/builder"
import { run } from "../packages/run"
import * as Database from "../packages/database"
import { Create, Read, Count, Delete, Test, Update } from "../packages/method"
import * as Type from "../packages/type"
import * as Mixin from "../packages/mixin"

it("async effect", async function () {
    let flag = false
    const ls = lifecycle(async function () {
        flag = true
    })

    const async_effect_model = await model({
        name: "async_effect_model",
        database: Database.Store,
        schema: {
            field: {
                type: Type.Text,
            },
        },
        bind: {
            read: {
                effect: [ls],
            },
        },
    })

    await run({
        model: async_effect_model,
        method: Read,
    })

    assert.equal(flag, true)
})
