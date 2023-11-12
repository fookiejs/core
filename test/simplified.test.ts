import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, lifecycle, mixin } from "../packages/builder"
import { run } from "../packages/run"
import * as Database from "../packages/database"
import { Create, Read, Count, Delete, Test, Update } from "../packages/method"
import * as Type from "../packages/type"
import * as Mixin from "../packages/mixin"

import Selection from "../packages/selection"

it("Features Simplified", async function () {
    const simplified_model = await model({
        name: "simplified_model",
        database: Database.Store,
        schema: {
            field: {
                type: Type.Text,
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

    await run({
        model: simplified_model,
        method: Create,
        body: {
            field: "abc",
        },
    })

    const res = await run({
        model: simplified_model,
        method: Read,
        options: {
            simplified: true,
        },
    })

    assert.equal(res.status, true)
})
