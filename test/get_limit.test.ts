import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, lifecycle, mixin } from "../packages/builder"
import { run } from "../packages/run"
import * as Database from "../packages/database"
import { Create, Read, Count, Delete, Test, Update } from "../packages/method"
import * as Type from "../packages/type"
import * as Mixin from "../packages/mixin"

it("get limit", async function () {
    const LimitTestModel = await model({
        database: Database.Store,
        name: "LimitTestModel",
        schema: {
            field: { type: Type.Text, required: true },
        },
        bind: {
            test: {},
            create: {},
            delete: {},
            read: {},
            count: {},
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
