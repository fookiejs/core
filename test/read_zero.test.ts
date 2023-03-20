import { it, describe, assert } from "vitest"
import { model, run, models } from "../index"
import { Store } from "../packages/databases"
import { Model, Field } from "../packages/decorators"
import { Create, Read } from "../packages/methods"
import { Text, Number } from "../packages/types"
import * as lodash from "lodash"

it("read_zero", async function () {
    // PHASE 1
    let read_zero_model = model({
        name: "read_zero_model",
        database: Store,
        schema: {
            number: {
                type: Number,
            },
        },
    })

    for (let i = -10; i < 10; i++) {
        await run({
            model: read_zero_model,
            method: Create,
            body: {
                number: i,
            },
        })
    }

    let read = await run({
        model: read_zero_model,
        method: Read,
        query: {
            filter: {
                id: "notexistedid",
                number: 0,
            },
        },
    })
    assert.equal(read.data.length === 0, true)
})
