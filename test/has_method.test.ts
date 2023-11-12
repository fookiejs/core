import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, lifecycle, mixin } from "../packages/builder"
import { run } from "../packages/run"
import * as Database from "../packages/database"
import { Create, Read, Count, Delete, Test, Update } from "../packages/method"
import * as Type from "../packages/type"
import * as Mixin from "../packages/mixin"

it("async effect", async function () {
    const HasMethodModel = await model({
        name: "HasMethodModel",
        database: Database.Store,
        schema: {
            name: { type: Type.Text, required: true },
            password: { type: Type.Text, required: true },
        },
    })

    const res = await run({
        model: HasMethodModel,
        method: "invalid_method",
    })
    assert.equal(res.status, false)
    assert.equal(res.error, "has_method")
})
