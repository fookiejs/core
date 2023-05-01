import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, run, models, lifecycle } from "../packages/core"
import { Store } from "../packages/database"
import { Model, Field } from "../packages/decorator"
import { Create, Read, Count, Delete, Test, Update } from "../packages/method"
import { Text, Integer, Array, Boolean, Buffer, Char, Function, Plain } from "../packages/type"
import { After, Before } from "../packages/mixin"

it("Unique", async function () {
    const UniqueNumber = await model({
        name: "number",
        database: Store,
        schema: {
            val: {
                type: Integer,
                unique: true,
            },
        },
    })

    await run({
        token: process.env.SYSTEM_TOKEN,
        model: UniqueNumber,
        method: Create,
        body: {
            val: 1,
        },
    })

    const res = await run({
        token: process.env.SYSTEM_TOKEN,
        model: UniqueNumber,
        method: Create,
        body: {
            val: 1,
        },
    })

    assert.equal(res.status, false)
    assert.equal(res.error, "unique")
})
