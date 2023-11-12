import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import * as Fookie from "../index"

it("Read return type must be array", async function () {
    let read_return_array = await Fookie.Builder.model({
        name: "read_return_array",
        database: Fookie.Dictionary.Database.store,
        schema: {
            msg: {
                type: Fookie.Dictionary.Type.text,
            },
        },
        bind: {
            create: {},
            read: {},
        },
    })

    for (let i = 0; i < 10; i++) {
        await Fookie.run({
            model: read_return_array,
            method: Fookie.Method.Create,
            body: {
                msg: "hi",
            },
        })
    }
    let res = await Fookie.run({
        token: process.env.SYSTEM_TOKEN,
        model: read_return_array,
        method: Fookie.Method.Read,
    })

    assert.equal(res.status, true)
    assert.equal(lodash.isArray(res.data), true)
})
