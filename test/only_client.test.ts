import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, run, models, lifecycle } from "../packages/core"
import { Store } from "../packages/database"
import { Model, Field } from "../packages/decorator"
import { Create, Read, Count, Delete, Test, Update } from "../packages/method"
import { Text, Integer, Array, Boolean, Buffer, Char, Function, Plain } from "../packages/type"
import { After, Before } from "../packages/mixin"

it("Unique", async function () {
    const only_client = await model({
        name: "only_client",
        database: Store,
        schema: {
            val: {
                type: Integer,
                only_client: true,
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

    const res = await run({
        model: only_client,
        method: Create,
        body: {
            val: 1,
        },
    })

    const res2 = await run({
        model: only_client,
        method: Create,
        body: {},
    })

    assert.equal(res.status, true)
    assert.equal(res2.status, false)
})
