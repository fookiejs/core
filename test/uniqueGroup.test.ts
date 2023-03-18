import { it, describe, assert } from "vitest"
import { model, run, models } from "../src"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create, Read } from "../src/methods"
import { Text, Number } from "../src/types"
import * as lodash from "lodash"

it("uniqueGroup", async function () {
    const nbmr = model({
        name: "number",
        database: Store,
        schema: {
            val1: {
                type: Number,
                unique_group: ["g1"],
            },
            val2: {
                type: Number,
                unique_group: ["g1"],
            },
            val3: {
                type: Number,
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
