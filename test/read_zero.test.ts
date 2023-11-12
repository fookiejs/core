import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, lifecycle, mixin } from "../packages/builder"
import { run } from "../packages/run"
import * as Database from "../packages/database"
import { Create, Read, Count, Delete, Test, Update } from "../packages/method"
import * as Type from "../packages/type"
import * as Mixin from "../packages/mixin"

it("read_zero", async function () {
    // PHASE 1
    let read_zero_model = await model({
        name: "read_zero_model",
        database: Database.Store,
        schema: {
            number: {
                type: Type.Integer,
            },
        },
        bind: {
            test: {},
            create: {},
            delete: {},
            read: {},
            count: {},
            sum: {},
        },
    })

    for (let i = -10; i < 10; i++) {
        await run({
            model: read_zero_model,
            method: Create,
            body: {
                number: i,
            },
        })
    }

    let read = await run({
        model: read_zero_model,
        method: Read,
        query: {
            filter: {
                id: "notexistedid",
                number: 0,
            },
        },
    })
    assert.equal(read.data.length === 0, true)
})
