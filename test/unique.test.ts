import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import * as Fookie from "../index"

it("Unique", async function () {
    const UniqueNumber = await Fookie.Builder.model({
        name: "number",
        database: Fookie.Dictionary.Database.store,
        schema: {
            val: {
                type: Fookie.Dictionary.Type.integer,
                unique: true,
            },
        },
        bind: {
            create: {},
        },
    })

    await Fookie.run({
        token: process.env.SYSTEM_TOKEN,
        model: UniqueNumber,
        method: Fookie.Method.Create,
        body: {
            val: 1,
        },
    })

    const res = await Fookie.run({
        token: process.env.SYSTEM_TOKEN,
        model: UniqueNumber,
        method: Fookie.Method.Create,
        body: {
            val: 1,
        },
    })

    assert.equal(res.status, false)
    assert.equal(res.error, "unique")
})
