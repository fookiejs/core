import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import * as Fookie from "../index"

it("get limit", async function () {
    const LimitTestModel = await Fookie.Builder.model({
        database: Fookie.Dictionary.Database.store,
        name: "LimitTestModel",
        schema: {
            field: { type: Fookie.Dictionary.Type.text, required: true },
        },
        bind: {
            test: {},
            create: {},
            delete: {},
            read: {},
            count: {},
        },
    })

    for (let i = 0; i < 10; i++) {
        await Fookie.run({
            model: LimitTestModel,
            method: Fookie.Method.Create,
            body: {
                field: "val",
            },
        })
    }
    const res = await Fookie.run({
        model: LimitTestModel,
        method: Fookie.Method.Read,
        query: {
            limit: 2,
        },
    })
    assert.equal(res.data.length, 2)
})
