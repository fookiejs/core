import { it, describe, assert } from "vitest"
import { model, run, models } from "../src"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create, Read } from "../src/methods"
import { Text } from "../src/types"
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
