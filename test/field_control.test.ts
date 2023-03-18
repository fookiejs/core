import { it, describe, assert } from "vitest"
import { model, run, models } from "../src"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create, Read } from "../src/methods"
import { Text } from "../src/types"
import * as lodash from "lodash"

it("field control", async function () {
    const r = await run({
        token: process.env.SYSTEM_TOKEN,
        model: "model",
        method: "create",
        body: {
            name: "fc_model",
            database: Store,
            schema: {
                f_number_1: {
                    type: "number",
                    min: 0,
                },
                f_number_2: {
                    type: "number",
                    max: 100,
                },
                f_array_1: {
                    type: "array",
                    maxSize: 2,
                },
                f_array_2: {
                    type: "array",
                    minSize: 2,
                },
            },
        },
    })

    const res_1 = await run({
        model: "fc_model",
        method: "create",
        body: {
            f_number_1: -1,
        },
    })

    const res_2 = await run({
        model: "fc_model",
        method: "create",
        body: {
            f_number_2: 101,
        },
    })

    const res_3 = await run({
        model: "fc_model",
        method: "create",
        body: {
            f_number_1: 0,
        },
    })

    const res_4 = await run({
        model: "fc_model",
        method: "create",
        body: {
            f_number_2: 100,
        },
    })

    const res_5 = await run({
        model: "fc_model",
        method: "create",
        body: {
            f_array_1: [1, 2, 3, 4],
        },
    })

    const res_6 = await run({
        model: "fc_model",
        method: "create",
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
