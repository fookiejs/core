import { it, describe, assert } from "vitest"
import { model, run, models } from "../index"
import { Store } from "../packages/databases"
import { Model, Field } from "../packages/decorators"
import { Create, Read, Test } from "../packages/methods"
import { nobody } from "../packages/roles"
import { Text, Number, Char } from "../packages/types"
import * as lodash from "lodash"

it("test_method", async function () {
    const test_model = model({
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
