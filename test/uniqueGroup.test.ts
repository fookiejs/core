import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, lifecycle, mixin } from "../packages/builder"
import { run } from "../packages/run"
import * as Database from "../packages/database"
import { Create, Read, Count, Delete, Test, Update } from "../packages/method"
import * as Type from "../packages/type"
import * as Mixin from "../packages/mixin"
import * as Role from "../packages/role"
import Selection from "../packages/selection"

it("uniqueGroup", async function () {
    const number = await model({
        name: "number",
        database: Database.Store,
        schema: {
            val1: {
                type: Type.Integer,
                unique_group: ["g1"],
            },
            val2: {
                type: Type.Integer,
                unique_group: ["g1"],
            },
            val3: {
                type: Type.Integer,
                unique_group: ["g1"],
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
        model: number,
        method: Create,
        body: {
            val1: 1,
            val2: 1,
            val3: 1,
        },
    })

    const res = await run({
        model: number,
        method: Create,
        body: {
            val1: 1,
            val2: 1,
            val3: 2,
        },
    })

    assert.equal(res.status, true)

    const res2 = await run({
        model: number,
        method: Create,
        body: {
            val1: 1,
            val2: 1,
            val3: 1,
        },
    })

    assert.equal(res2.status, false)
})
