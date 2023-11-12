import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import * as Fookie from "../index"

it("Unique", async function () {
    const only_server = await Fookie.Builder.model({
        name: "only_server",
        database: Fookie.Dictionary.Database.store,
        schema: {
            val: {
                type: Fookie.Dictionary.Type.integer,
                only_server: true,
                default: -1,
            },
        },
    })

    const res = await Fookie.run({
        token: process.env.SYSTEM_TOKEN,
        model: only_server,
        method: Fookie.Method.Create,
        body: {
            val: 1,
        },
    })

    const res2 = await Fookie.run({
        token: process.env.SYSTEM_TOKEN,
        model: only_server,
        method: Fookie.Method.Create,
        body: {},
    })

    assert.equal(res.status, false)
    assert.equal(res2.status, true)
})
