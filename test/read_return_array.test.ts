import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, run, models, lifecycle } from "../packages/core"
import { Store } from "../packages/database"
import { Model, Field } from "../packages/decorator"
import { Create, Read, Count, Delete, Test, Update } from "../packages/method"
import { Text, Array, Boolean, Buffer, Char, Function, Plain } from "../packages/type"
import { After, Before } from "../packages/mixin"

it("Read return type must be array", async function () {
    let read_return_array = await model({
        name: "read_return_array",
        database: Store,
        schema: {
            msg: {
                type: Text,
            },
        },
        bind: {
            create: {},
            read: {},
        },
    })

    for (let i = 0; i < 10; i++) {
        await run({
            model: read_return_array,
            method: Create,
            body: {
                msg: "hi",
            },
        })
    }
    let res = await run({
        token: process.env.SYSTEM_TOKEN,
        model: read_return_array,
        method: Read,
    })

    assert.equal(res.status, true)
    assert.equal(lodash.isArray(res.data), true)
})
