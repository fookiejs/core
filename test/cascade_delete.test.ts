import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import * as Fookie from "../index"

it("cascade delete", async function () {
    const CascadeDeleteParent = await await Fookie.Builder.model({
        name: "CascadeDeleteParent",
        database: Fookie.Dictionary.Database.store,
        schema: {
            name: { type: Fookie.Dictionary.Type.text, required: true },
        },
        bind: {
            test: {},
            create: {},
            delete: {},
            read: {},
            count: {},
        },
    })

    const CascadeDeleteChild = await await Fookie.Builder.model({
        name: "CascadeDeleteChild",
        database: Fookie.Dictionary.Database.store,
        schema: {
            parent: { type: Fookie.Dictionary.Type.text, relation: CascadeDeleteParent, cascade_delete: true },
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
        await Fookie.run({
            model: CascadeDeleteParent,
            method: Fookie.Method.Create,
            body: {
                name: "parent_1",
            },
        })
    ).data

    for (let i = 0; i < 10; i++) {
        await Fookie.run<any, "create">({
            model: CascadeDeleteChild,
            method: Fookie.Method.Create,
            body: {
                parent: parent.id,
            },
        })
    }

    await Fookie.run<unknown, "delete">({
        model: CascadeDeleteParent,
        method: Fookie.Method.Delete,
        query: {
            filter: {
                name: {
                    equals: "parent_1",
                },
            },
        },
    })

    let count = (
        await Fookie.run({
            model: CascadeDeleteChild,
            method: Fookie.Method.Count,
            query: {
                filter: {},
            },
        })
    ).data

    assert.equal(count, 0)
})
