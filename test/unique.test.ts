import { it, describe, assert } from "vitest"
import { model, run, models } from "../src"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create, Read } from "../src/methods"
import { Text, Number } from "../src/types"
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
