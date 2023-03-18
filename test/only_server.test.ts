import { it, describe, assert } from "vitest"
import { model, run, models } from "../src"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create, Read } from "../src/methods"
import { Text, Number } from "../src/types"
import * as lodash from "lodash"

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
