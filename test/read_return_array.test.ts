import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, lifecycle, mixin } from "../packages/builder"
import { run } from "../packages/run"
import * as Database from "../packages/database"
import { Create, Read, Count, Delete, Test, Update } from "../packages/method"
import * as Type from "../packages/type"
import * as Mixin from "../packages/mixin"

it("Read return type must be array", async function () {
    let read_return_array = await model({
        name: "read_return_array",
        database: Database.Store,
        schema: {
            msg: {
                type: Type.Text,
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
