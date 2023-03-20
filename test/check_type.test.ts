import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, run, models, lifecycle } from "@fookie/core"
import { Store, database } from "@fookie/database"
import { Model, Field } from "@fookie/decorator"
import { Create, Read, Count, Delete, Test, Update } from "@fookie/method"
import { Text, Number, Array, Boolean, Buffer, Char, Function, Plain } from "@fookie/type"
import { mixin, After, Before } from "@fookie/mixin"

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
