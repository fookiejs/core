import { it, describe, assert } from "vitest"
import { model, run, models } from "../index"
import { Store } from "../packages/databases"
import { Model, Field } from "../packages/decorators"
import { Create, Read } from "../packages/methods"
import { Text, Number } from "../packages/types"
import * as lodash from "lodash"

it("check_type", async function () {
    await model({
        name: "model_check_type",
        database: Store,
        schema: {
            field: {
                type: Text,
            },
        },
    })

    const res = await run({
        model: "model_check_type",
        method: Create,
        body: {
            field: 123,
        },
    })

    assert.equal(res.status, false)
    assert.equal(res.error, "check_type")
})
