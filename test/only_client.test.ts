import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, lifecycle, mixin } from "../packages/builder"
import { run } from "../packages/run"
import * as Database from "../packages/database"
import { Create, Read, Count, Delete, Test, Update } from "../packages/method"
import * as Type from "../packages/type"
import * as Mixin from "../packages/mixin"
import * as Role from "../packages/role"

it("Unique", async function () {
    const only_client = await model({
        name: "only_client",
        database: Database.Store,
        schema: {
            val: {
                type: Type.Integer,
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
