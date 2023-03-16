import { it, describe, assert } from "vitest"
import { model, run, models } from "../src"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create, Read } from "../src/methods"
import { Text } from "../src/types"
import * as lodash from "lodash"

it("test_method", async function () {
    await init
    await run({
        token: "system_token",
        model: "model",
        method: "create",
        body: {
            name: "test_method",
            database: Store,
            schema: {
                field: {
                    type: "char",
                },
            },
            lifecycle: {
                read: {
                    role: ["nobody"],
                },
            },
        },
    })

    const res1 = await run({
        model: "test_method",
        method: "test",
        options: {
            method: "read",
        },
    })

    assert.equal(res1.data.status, false)
    assert.equal(res1.status, true)

    const res2 = await run({
        model: "test_method",
        method: "test",
        body: {
            field: "h",
        },
        options: {
            method: "create",
        },
    })

    assert.equal(res2.data.status, true)
    assert.equal(res2.status, true)
})
