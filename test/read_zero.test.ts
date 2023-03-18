import { it, describe, assert } from "vitest"
import { model, run, models } from "../src"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create, Read } from "../src/methods"
import { Text } from "../src/types"
import * as lodash from "lodash"

it("read_zero", async function () {
    // PHASE 1
    let model_res = model({
        name: "read_zero_model",
        database: Store,
        schema: {
            number: {
                type: "number",
            },
        },
    })

    for (let i = -10; i < 10; i++) {
        let create = await run({
            model: "read_zero_model",
            method: "create",
            body: {
                number: i,
            },
        })
    }

    let read = await run({
        model: "read_zero_model",
        method: "read",
        query: {
            filter: {
                id: "notexistedid",
                number: 0,
            },
        },
    })
    assert.equal(read.data.length === 0, true)
})
