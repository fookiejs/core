import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, run, models, lifecycle } from "../packages/core"
import { Store } from "../packages/database"
import { Model, Field } from "../packages/decorator"
import { Create, Read, Count, Delete, Test, Update } from "../packages/method"
import { Text, Integer, Array, Boolean, Buffer, Char, Function, Plain } from "../packages/type"
import { After, Before } from "../packages/mixin"

it("uniqueGroup", async function () {
    const nbmr = model({
        name: "number",
        database: Store,
        schema: {
            val1: {
                type: Integer,
                unique_group: ["g1"],
            },
            val2: {
                type: Integer,
                unique_group: ["g1"],
            },
            val3: {
                type: Integer,
                unique_group: ["g1"],
            },
        },
    })

    await run({
        model: nbmr,
        method: Create,
        body: {
            val1: 1,
            val2: 1,
            val3: 1,
        },
    })

    const res = await run({
        model: nbmr,
        method: Create,
        body: {
            val1: 1,
            val2: 1,
            val3: 2,
        },
    })

    assert.equal(res.status, true)

    const res2 = await run({
        model: "number",
        method: Create,
        body: {
            val1: 1,
            val2: 1,
            val3: 1,
        },
    })

    assert.equal(res2.status, false)
})
