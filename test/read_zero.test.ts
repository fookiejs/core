import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, run, models, lifecycle } from "../packages/core"
import { Store } from "../packages/database"
import { Model, Field } from "../packages/decorator"
import { Create, Read, Count, Delete, Test, Update } from "../packages/method"
import { Text, Integer, Array, Boolean, Buffer, Char, Function, Plain } from "../packages/type"
import { After, Before } from "../packages/mixin"

it("read_zero", async function () {
    // PHASE 1
    let read_zero_model = await model({
        name: "read_zero_model",
        database: Store,
        schema: {
            number: {
                type: Integer,
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
