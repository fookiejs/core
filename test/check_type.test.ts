import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import * as Fookie from "../index"

it("check_type", async function () {
    const model_check_type = await Fookie.Builder.model({
        name: "model_check_type",
        database: Fookie.Dictionary.Database.store,
        schema: {
            field: {
                type: Fookie.Dictionary.Type.text,
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

    const res = await Fookie.run({
        model: model_check_type,
        method: Fookie.Method.Create,
        body: {
            field: 123,
        },
    })

    assert.equal(res.status, false)
    assert.equal(res.error, "check_type")
})
