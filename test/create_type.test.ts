import { it, describe, assert } from "vitest"
import { model, run, models, type } from "../index"
import { Store } from "../packages/databases"
import { Model, Field } from "../packages/decorators"
import { Create, Read } from "../packages/methods"
import { Text, Number } from "../packages/types"
import * as lodash from "lodash"

it("invalid token", async function () {
    const MyType = type(function (v) {
        return true
    })

    const my_type_model = model({
        name: "my_type_model",
        database: Store,
        schema: {
            field: {
                type: MyType,
                required: true,
            },
        },
    })

    const res = await run({
        model: my_type_model,
        method: Create,
        body: {
            field: "test",
        },
    })

    assert.equal(res.status, true)
})
