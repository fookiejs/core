import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, run, models, lifecycle } from "../packages/core"
import { Store, database } from "../packages/database"
import { Model, Field } from "../packages/decorator"
import { Create, Read, Count, Delete, Test, Update } from "../packages/method"
import { Text, Number, Array, Boolean, Buffer, Char, Function, Plain } from "../packages/type"
import { mixin, After, Before } from "../packages/mixin"

it("Count return value must be number", async function () {
    const ModelToCount = await model({
        name: "ModelToCount",
        database: Store,
        schema: {
            name: { type: Text, required: true },
            password: { type: Text, required: true },
        },
    })

    let res = await run({
        token: process.env.SYSTEM_TOKEN,
        model: ModelToCount,
        method: Count,
    })
    assert.equal(typeof res.data, "number")
})
