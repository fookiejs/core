import { it, describe, assert } from "vitest"
import { model, run, models } from "../index"
import { Store } from "../packages/databases"
import { Model, Field } from "../packages/decorators"
import { Create, Read } from "../packages/methods"
import { Text, Number } from "../packages/types"
import * as lodash from "lodash"

it("Unique", async function () {
    const UniqueNumber = model({
        name: "number",
        database: Store,
        schema: {
            val: {
                type: Number,
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
