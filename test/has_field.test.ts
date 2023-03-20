import { it, describe, assert } from "vitest"
import { model, run, models } from "../index"
import { Store } from "../packages/databases"
import { Model, Field } from "../packages/decorators"
import { Create, Read } from "../packages/methods"
import { Text, Number } from "../packages/types"
import * as lodash from "lodash"

it("Has field", async function () {
    const has_field_model = model({
        name: "hf_model",
        database: Store,
        schema: {
            field: {
                type: Text,
                required: true,
            },
        },
    })

    const res = await run({
        model: has_field_model,
        method: Create,
        body: {
            abc: "hello",
        },
    })

    assert.equal(res.status, false)
    assert.equal(res.error, "has_field")
})
