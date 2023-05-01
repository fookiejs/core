import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, run, models, lifecycle } from "../packages/core"
import { Store } from "../packages/database"
import { Model, Field } from "../packages/decorator"
import { Create, Read, Count, Delete, Test, Update } from "../packages/method"
import { Text, Array, Boolean, Buffer, Char, Function, Plain } from "../packages/type"
import { After, Before } from "../packages/mixin"
import { nobody, everybody, system } from "../packages/role"

it("get limit", async function () {
    const LimitTestModel = await model({
        database: Store,
        name: "LimitTestModel",
        schema: {
            field: { type: Text, required: true },
        },
    })

    for (let i = 0; i < 10; i++) {
        await run({
            model: LimitTestModel,
            method: Create,
            body: {
                field: "val",
            },
        })
    }
    const res = await run({
        model: LimitTestModel,
        method: Read,
        query: {
            limit: 2,
        },
    })
    assert.equal(res.data.length, 2)
})
