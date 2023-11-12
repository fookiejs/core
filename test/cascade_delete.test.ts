import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, lifecycle, mixin } from "../packages/builder"
import { run } from "../packages/run"
import * as Database from "../packages/database"
import { Create, Read, Count, Delete, Test, Update } from "../packages/method"
import * as Type from "../packages/type"
import * as Mixin from "../packages/mixin"

it("cascade delete", async function () {
    const CascadeDeleteParent = await await model({
        name: "CascadeDeleteParent",
        database: Database.Store,
        schema: {
            name: { type: Type.Text, required: true },
        },
        bind: {
            test: {},
            create: {},
            delete: {},
            read: {},
            count: {},
        },
    })

    const CascadeDeleteChild = await await model({
        name: "CascadeDeleteChild",
        database: Database.Store,
        schema: {
            parent: { type: Type.Text, relation: CascadeDeleteParent, cascade_delete: true },
        },
        bind: {
            test: {},
            create: {},
            delete: {},
            read: {},
            count: {},
        },
    })

    const parent = (
        await run({
            model: CascadeDeleteParent,
            method: Create,
            body: {
                name: "parent_1",
            },
        })
    ).data

    for (let i = 0; i < 10; i++) {
        await run({
            model: CascadeDeleteChild,
            method: Create,
            body: {
                parent: parent.id,
            },
        })
    }

    await run({
        model: CascadeDeleteParent,
        method: Delete,
        query: {
            filter: {
                name: "parent_1",
            },
        },
    })

    let count = (
        await run({
            model: CascadeDeleteChild,
            method: Count,
            query: {
                filter: {},
            },
        })
    ).data

    assert.equal(count, 0)
})
