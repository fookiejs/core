import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model } from "../packages/builder"
import { run } from "../packages/run"
import * as Database from "../packages/database"

import { Create, Read, Count, Delete, Test, Update } from "../packages/method"
import * as Type from "../packages/type"
import * as Mixin from "../packages/mixin"

it("field control", async function () {
    const field_control_model = await model({
        name: "field_control_model",
        database: Database.Store,
        schema: {
            f_number_1: {
                type: Type.Integer,
                minimum: 0,
            },
            f_number_2: {
                type: Type.Integer,
                maximum: 100,
            },
            f_array_1: {
                type: Type.Array(Type.Integer),
                maximum_size: 2,
            },
            f_array_2: {
                type: Type.Array(Type.Integer),
                minimum_size: 2,
            },
        },
        bind: {
            test: {},
            create: {},
            delete: {},
            read: {},
            count: {},
        },
    })

    const res_1 = await run({
        model: field_control_model,
        method: Create,
        body: {
            f_number_1: -1,
        },
    })

    const res_2 = await run({
        model: field_control_model,
        method: Create,
        body: {
            f_number_2: 101,
        },
    })

    const res_3 = await run({
        model: field_control_model,
        method: Create,
        body: {
            f_number_1: 0,
        },
    })

    const res_4 = await run({
        model: field_control_model,
        method: Create,
        body: {
            f_number_2: 100,
        },
    })

    const res_5 = await run({
        model: field_control_model,
        method: Create,
        body: {
            f_array_1: [1, 2, 3, 4],
        },
    })

    const res_6 = await run({
        model: field_control_model,
        method: Create,
        body: {
            f_array_2: [],
        },
    })

    assert.equal(res_1.status, false)
    assert.equal(res_2.status, false)
    assert.equal(res_3.status, true)
    assert.equal(res_4.status, true)
    assert.equal(res_5.status, false)
    assert.equal(res_6.status, false)
})
