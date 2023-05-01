import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, run, models, lifecycle } from "../packages/core"
import { Store, database } from "../packages/database"
import { Model, Field } from "../packages/decorator"
import { Create, Read, Count, Delete, Test, Update } from "../packages/method"
import { Text, Number, Array, Boolean, Buffer, Char, Function, Plain } from "../packages/type"
import { mixin, After, Before } from "../packages/mixin"

it("cascade delete", async function () {
    const CascadeDeleteParent = await await model({
        name: "CascadeDeleteParent",
        database: Store,
        schema: {
            name: { type: Text, required: true },
        },
    })

    const CascadeDeleteChild = await await model({
        name: "CascadeDeleteChild",
        database: Store,
        schema: {
            parent: { type: Text, relation: CascadeDeleteParent, cascade_delete: true },
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
