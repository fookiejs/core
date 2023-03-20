import { it, describe, assert } from "vitest"
import { model, run, models } from "../index"
import { Store } from "../packages/databases"
import { Model, Field } from "../packages/decorators"
import { Create, Read } from "../packages/methods"
import { Text, Number } from "../packages/types"
import * as lodash from "lodash"

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
