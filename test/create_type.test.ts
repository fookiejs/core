import { it, describe, assert } from "vitest"
import { model, run, models, type } from "../src"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create, Read } from "../src/methods"
import { Text, Number } from "../src/types"
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
