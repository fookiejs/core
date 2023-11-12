import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import * as Fookie from "../index"

it("Unique", async function () {
    const only_client = await Fookie.Builder.model({
        name: "only_client",
        database: Fookie.Dictionary.Database.store,
        schema: {
            val: {
                type: Fookie.Dictionary.Type.integer,
                only_client: true,
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
        model: only_client,
        method: Fookie.Method.Create,
        body: {
            val: 1,
        },
    })

    const res2 = await Fookie.run({
        model: only_client,
        method: Fookie.Method.Create,
        body: {},
    })

    assert.equal(res.status, true)
    assert.equal(res2.status, false)
})
