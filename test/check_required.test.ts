import { it, describe, assert } from "vitest"
import { model, run, models } from "../src"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create, Read } from "../src/methods"
import { Text } from "../src/types"
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
        method: "create",
        body: {},
    })

    assert.equal(response.status, false)
    assert.equal(response.error, "check_required")
})
