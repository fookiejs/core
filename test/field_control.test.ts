import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, run, models, lifecycle } from "@fookie/core"
import { Store, database } from "@fookie/database"
import { Model, Field } from "@fookie/decorator"
import { Create, Read, Count, Delete, Test, Update } from "@fookie/method"
import { Text, Number, Array, Boolean, Buffer, Char, Function, Plain, type } from "@fookie/type"
import { mixin, After, Before } from "@fookie/mixin"

it("field control", async function () {
    const field_control_model = model({
        name: "field_control_model",
        database: Store,
        schema: {
            f_number_1: {
                type: Number,
                minimum: 0,
            },
            f_number_2: {
                type: Number,
                maximum: 100,
            },
            f_array_1: {
                type: Array,
                maximum_size: 2,
            },
            f_array_2: {
                type: Array,
                minimum_size: 2,
            },
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
