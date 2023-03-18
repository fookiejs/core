import { it, describe, assert } from "vitest"
import { model, run, models } from "../src"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create, Read } from "../src/methods"
import { Text, Number } from "../src/types"
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
