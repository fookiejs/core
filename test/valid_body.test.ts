import { it, describe, assert } from "vitest"
import { model, run, models } from "../index"
import { Store } from "../packages/databases"
import { Model, Field } from "../packages/decorators"
import { Create, Read } from "../packages/methods"
import { Text, Number } from "../packages/types"
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
