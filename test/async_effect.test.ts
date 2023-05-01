import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, run, models, lifecycle } from "../packages/core"
import { Store } from "../packages/database"
import { Model, Field } from "../packages/decorator"
import { Create, Read, Count, Delete, Test, Update } from "../packages/method"
import { Text, Array, Boolean, Buffer, Char, Function, Plain } from "../packages/type"
import { After, Before } from "../packages/mixin"

it("async effect", async function () {
    let flag = false
    const ls = lifecycle(async function () {
        flag = true
    })

    await await model({
        name: "async_effect_model",
        database: Store,
        schema: {
            field: {
                type: Text,
            },
        },
        bind: {
            read: {
                effect: [ls],
            },
        },
    })

    await run({
        model: "async_effect_model",
        method: Read,
    })

    assert.equal(flag, true)
})
