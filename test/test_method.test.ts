import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, run, models, lifecycle } from "../packages/core"
import { Store, database } from "../packages/database"
import { Model, Field } from "../packages/decorator"
import { Create, Read, Count, Delete, Test, Update } from "../packages/method"
import { Text, Number, Array, Boolean, Buffer, Char, Function, Plain } from "../packages/type"
import { mixin, After, Before } from "../packages/mixin"
import { nobody, everybody, system } from "../packages/role"

it("test_method", async function () {
    const test_model = await model({
        name: "test_model",
        database: Store,
        schema: {
            field: {
                type: Char,
            },
        },
        bind: {
            read: {
                role: [nobody],
            },
        },
    })

    const res1 = await run({
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
