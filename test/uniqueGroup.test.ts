import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import * as Fookie from "../index"

it("uniqueGroup", async function () {
    const number = await Fookie.Builder.model({
        name: "number",
        database: Fookie.Dictionary.Database.store,
        schema: {
            val1: {
                type: Fookie.Dictionary.Type.integer,
                unique_group: ["g1"],
            },
            val2: {
                type: Fookie.Dictionary.Type.integer,
                unique_group: ["g1"],
            },
            val3: {
                type: Fookie.Dictionary.Type.integer,
                unique_group: ["g1"],
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

    await Fookie.run({
        model: number,
        method: Fookie.Method.Create,
        body: {
            val1: 1,
            val2: 1,
            val3: 1,
        },
    })

    const res = await Fookie.run({
        model: number,
        method: Fookie.Method.Create,
        body: {
            val1: 1,
            val2: 1,
            val3: 2,
        },
    })

    assert.equal(res.status, true)

    const res2 = await Fookie.run({
        model: number,
        method: Fookie.Method.Create,
        body: {
            val1: 1,
            val2: 1,
            val3: 1,
        },
    })

    assert.equal(res2.status, false)
})
