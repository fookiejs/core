import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, lifecycle, mixin } from "../packages/builder"
import { run } from "../packages/run"
import * as Database from "../packages/database"
import { Create, Read, Count, Delete, Test, Update } from "../packages/method"
import * as Type from "../packages/type"
import * as Mixin from "../packages/mixin"

it("Unique", async function () {
    const UniqueNumber = await model({
        name: "number",
        database: Database.Store,
        schema: {
            val: {
                type: Type.Integer,
                unique: true,
            },
        },
        bind: {
            create: {},
        },
    })

    await run({
        token: process.env.SYSTEM_TOKEN,
        model: UniqueNumber,
        method: Create,
        body: {
            val: 1,
        },
    })

    const res = await run({
        token: process.env.SYSTEM_TOKEN,
        model: UniqueNumber,
        method: Create,
        body: {
            val: 1,
        },
    })

    assert.equal(res.status, false)
    assert.equal(res.error, "unique")
})
