import { it, describe, assert } from "vitest"
import { model, run, models } from "../index"
import { Store } from "../packages/databases"
import { Model, Field } from "../packages/decorators"
import { Create, Read } from "../packages/methods"
import { Text, Number } from "../packages/types"
import * as lodash from "lodash"

it("Features Simplified", async function () {
    const simplified_model = model({
        name: "simplified_model",
        database: Store,
        schema: {
            field: {
                type: Text,
            },
        },
    })

    await run({
        model: simplified_model,
        method: Create,
        body: {
            field: "abc",
        },
    })

    const res = await run({
        model: simplified_model,
        method: Read,
        options: {
            simplified: true,
        },
    })

    assert.equal(res.status, true)
})
