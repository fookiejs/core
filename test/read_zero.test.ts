import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import * as Fookie from "../index"

it("read_zero", async function () {
    // PHASE 1
    const read_zero_model = await Fookie.Builder.model({
        name: "read_zero_model",
        database: Fookie.Dictionary.Database.store,
        schema: {
            number: {
                type: Fookie.Dictionary.Type.integer,
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
        await Fookie.run({
            model: read_zero_model,
            method: Fookie.Method.Create,
            body: {
                number: i,
            },
        })
    }

    const read = await Fookie.run<any, "read">({
        model: read_zero_model,
        method: Fookie.Method.Read,
        query: {
            filter: {
                id: { equals: "notexistedid" },
                number: { equals: 0 },
            },
        },
    })

    assert.equal(read.data.length === 0, true)
})
