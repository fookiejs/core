import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, run, models, lifecycle } from "@fookie/core"
import { Store, database } from "@fookie/database"
import { Model, Field } from "@fookie/decorator"
import { Create, Read, Count, Delete, Test, Update } from "@fookie/method"
import { Text, Number, Array, Boolean, Buffer, Char, Function, Plain, type } from "@fookie/type"
import { mixin, After, Before } from "@fookie/mixin"

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
