import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, lifecycle, mixin } from "../packages/builder"
import { run } from "../packages/run"
import * as Database from "../packages/database"
import { Create, Read, Count, Delete, Test, Update } from "../packages/method"
import * as Type from "../packages/type"
import * as Mixin from "../packages/mixin"
import * as Lifecycle from "../packages/lifecycle"

it("test_method", async function () {
    const test_model = await model({
        name: "test_model",
        database: Database.Store,
        schema: {
            field: {
                type: Type.Char,
            },
        },
        bind: {
            read: {
                role: [Lifecycle.nobody],
            },
            test: {},
            create: {},
        },
    })

    const res1 = await run<unknown, "test">({
        model: test_model,
        method: Test,
        options: {
            method: "read",
        },
    })

    assert.equal(res1.data.status, false)
    assert.equal(res1.status, true)

    const res2 = await run({
        model: test_model,
        method: Test,
        body: {
            field: "h",
        },
        options: {
            method: Create,
        },
    })

    assert.equal(res2.data.status, true)
    assert.equal(res2.status, true)
})
