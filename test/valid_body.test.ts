import { it, describe, assert } from "vitest"
import { model, run, models } from "../src"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create, Read } from "../src/methods"
import { Text, Number } from "../src/types"
import * as lodash from "lodash"

it("valid body", async function () {
    const has_body_model = model({
        name: "has_body_model",
        database: Store,
        schema: {
            field: {
                type: Text,
                required: true,
            },
        },
    })

    const res = await run({
        model: has_body_model,
        method: Create,
        body: 1,
    })

    assert.equal(res.status, false)
    assert.equal(res.error, "validate_payload")
})
