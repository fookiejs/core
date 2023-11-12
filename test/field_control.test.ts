import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import * as Fookie from "../index"

it("field control", async function () {
    const field_control_model = await Fookie.Builder.model({
        name: "field_control_model",
        database: Fookie.Dictionary.Database.store,
        schema: {
            f_number_1: {
                type: Fookie.Dictionary.Type.integer,
                minimum: 0,
            },
            f_number_2: {
                type: Fookie.Dictionary.Type.integer,
                maximum: 100,
            },
            f_array_1: {
                type: Fookie.Dictionary.Type.array(Fookie.Dictionary.Type.integer),
                maximum_size: 2,
            },
            f_array_2: {
                type: Fookie.Dictionary.Type.array(Fookie.Dictionary.Type.integer),
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

    const res_1 = await Fookie.run({
        model: field_control_model,
        method: Fookie.Method.Create,
        body: {
            f_number_1: -1,
        },
    })

    const res_2 = await Fookie.run({
        model: field_control_model,
        method: Fookie.Method.Create,
        body: {
            f_number_2: 101,
        },
    })

    const res_3 = await Fookie.run({
        model: field_control_model,
        method: Fookie.Method.Create,
        body: {
            f_number_1: 0,
        },
    })

    const res_4 = await Fookie.run({
        model: field_control_model,
        method: Fookie.Method.Create,
        body: {
            f_number_2: 100,
        },
    })

    const res_5 = await Fookie.run({
        model: field_control_model,
        method: Fookie.Method.Create,
        body: {
            f_array_1: [1, 2, 3, 4],
        },
    })

    const res_6 = await Fookie.run({
        model: field_control_model,
        method: Fookie.Method.Create,
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
