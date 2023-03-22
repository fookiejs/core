import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, run, models, lifecycle } from "../packages/core"
import { Store, database } from "../packages/database"
import { Model, Field } from "../packages/decorator"
import { Create, Read, Count, Delete, Test, Update } from "../packages/method"
import { Text, Number, Array, Boolean, Buffer, Char, Function, Plain } from "../packages/type"
import { mixin, After, Before } from "../packages/mixin"

it("Features Simplified", async function () {
    const simplified_model = model({
        name: "simplified_model",
        database: Store,
        schema: {
            field: {
                type: Text,
            },
        },
    })

    await run({
        model: simplified_model,
        method: Create,
        body: {
            field: "abc",
        },
    })

    const res = await run({
        model: simplified_model,
        method: Read,
        options: {
            simplified: true,
        },
    })

    assert.equal(res.status, true)
})
