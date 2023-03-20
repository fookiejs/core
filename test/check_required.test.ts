import { it, describe, assert } from "vitest"
import { model, run, models } from "../index"
import { Store } from "../packages/databases"
import { Model, Field } from "../packages/decorators"
import { Create, Read } from "../packages/methods"
import { Text, Number } from "../packages/types"
import * as lodash from "lodash"

it("async effect", async function () {
    await model({
        name: "cr_model",
        database: Store,
        schema: {
            fieid: {
                type: Text,
                required: true,
            },
        },
    })

    const response = await run({
        model: "cr_model",
        method: Create,
        body: {},
    })

    assert.equal(response.status, false)
    assert.equal(response.error, "check_required")
})
