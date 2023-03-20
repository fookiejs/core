import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, run, models, lifecycle } from "@fookie/core"
import { Store, database } from "@fookie/database"
import { Model, Field } from "@fookie/decorator"
import { Create, Read, Count, Delete, Test, Update } from "@fookie/method"
import { Text, Number, Array, Boolean, Buffer, Char, Function, Plain } from "@fookie/type"
import { mixin, After, Before } from "@fookie/mixin"

it("Unique", async function () {
    model({
        name: "only_server",
        database: Store,
        schema: {
            val: {
                type: Number,
                only_server: true,
                default: -1,
            },
        },
    })

    const res = await run({
        token: process.env.SYSTEM_TOKEN,
        model: "only_server",
        method: Create,
        body: {
            val: 1,
        },
    })

    const res2 = await run({
        token: process.env.SYSTEM_TOKEN,
        model: "only_server",
        method: Create,
        body: {},
    })

    assert.equal(res.status, false)
    assert.equal(res2.status, true)
})
