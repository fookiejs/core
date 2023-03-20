import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, run, models, lifecycle } from "@fookie/core"
import { Store, database } from "@fookie/database"
import { Model, Field } from "@fookie/decorator"
import { Create, Read, Count, Delete, Test, Update } from "@fookie/method"
import { Text, Number, Array, Boolean, Buffer, Char, Function, Plain } from "@fookie/type"
import { mixin, After, Before } from "@fookie/mixin"

it("Read return type must be array", async function () {
    let read_return_array = model({
        name: "read_return_array",
        database: Store,
        schema: {
            msg: {
                type: Text,
            },
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
