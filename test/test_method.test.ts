import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import * as Fookie from "../index"

it("test_method", async function () {
    const test_model = await Fookie.Builder.model({
        name: "test_model",
        database: Fookie.Dictionary.Database.store,
        schema: {
            field: {
                type: Fookie.Dictionary.Type.char,
            },
        },
        bind: {
            read: {
                role: [Fookie.Dictionary.Lifecycle.nobody],
            },
            test: {},
            create: {},
        },
    })

    const res1 = await Fookie.run<unknown, "test">({
        model: test_model,
        method: Fookie.Method.Test,
        options: {
            method: "read",
        },
    })

    assert.equal(res1.data.status, false)
    assert.equal(res1.status, true)

    const res2 = await Fookie.run({
        model: test_model,
        method: Fookie.Method.Test,
        body: {
            field: "h",
        },
        options: {
            method: Fookie.Method.Create,
        },
    })

    assert.equal(res2.data.status, true)
    assert.equal(res2.status, true)
})
