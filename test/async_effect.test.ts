import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, run, models, lifecycle } from "@fookie/core"
import { Store, database } from "@fookie/database"
import { Model, Field } from "@fookie/decorator"
import { Create, Read, Count, Delete, Test, Update } from "@fookie/method"
import { Text, Number, Array, Boolean, Buffer, Char, Function, Plain } from "@fookie/type"
import { mixin, After, Before } from "@fookie/mixin"

it("async effect", async function () {
    let flag = false
    const ls = lifecycle(async function () {
        flag = true
    })

    model({
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
