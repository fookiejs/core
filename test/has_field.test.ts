import { it, describe, assert } from "vitest"
import { model, run, models } from "../src"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create, Read } from "../src/methods"
import { Text, Number } from "../src/types"
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
