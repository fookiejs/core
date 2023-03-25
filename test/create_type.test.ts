import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, run, models, lifecycle, type, database, mixin } from "../packages/core"
import { Store } from "../packages/database"
import { Model, Field } from "../packages/decorator"
import { Create, Read, Count, Delete, Test, Update } from "../packages/method"
import { Text, Number, Array, Boolean, Buffer, Char, Function, Plain } from "../packages/type"
import { After, Before } from "../packages/mixin"

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
