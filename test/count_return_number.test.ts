import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, lifecycle, mixin } from "../packages/builder"
import { run } from "../packages/run"
import * as Database from "../packages/database"
import { Create, Read, Count, Delete, Test, Update } from "../packages/method"
import * as Type from "../packages/type"
import * as Mixin from "../packages/mixin"
import * as Role from "../packages/role"

it("Count return value must be number", async function () {
    const ModelToCount = await model({
        name: "ModelToCount",
        database: Database.Store,
        schema: {
            name: { type: Type.Text, required: true },
            password: { type: Type.Text, required: true },
        },
    })

    let res = await run({
        token: process.env.SYSTEM_TOKEN,
        model: ModelToCount,
        method: Count,
    })
    assert.equal(typeof res.data, "number")
})
