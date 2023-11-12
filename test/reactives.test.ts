import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, lifecycle, mixin } from "../packages/builder"
import { run } from "../packages/run"
import * as Database from "../packages/database"
import { Create, Read, Count, Delete, Test, Update } from "../packages/method"
import * as Type from "../packages/type"
import * as Mixin from "../packages/mixin"

it("Reactives", async function () {
    const reactive_child = await model({
        name: "reactive_child",
        database: Database.Store,
        schema: {
            name: {
                type: Type.Text,
                required: true,
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

    const reactive_parent = await model({
        name: "reactive_parent",
        database: Database.Store,
        schema: {
            name: {
                type: Type.Text,
                required: true,
            },
            child: {
                relation: reactive_child,
                reactives: [
                    {
                        from: "name",
                        to: "name",
                        compute: (v) => v + "hi",
                    },
                ],
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

    const create_child_res = await run({
        token: process.env.SYSTEM_TOKEN,
        model: reactive_child,
        method: Create,
        body: {
            name: "child",
        },
    })

    const create_parent_res = await run({
        token: process.env.SYSTEM_TOKEN,
        model: reactive_parent,
        method: Create,
        body: {
            name: "parent",
            child: create_child_res.data.id,
        },
    })

    await run({
        token: process.env.SYSTEM_TOKEN,
        model: reactive_parent,
        method: "update",
        query: {
            filter: {},
        },
        body: {
            name: "parent",
        },
    })

    let res = await run({
        model: reactive_child,
        method: "read",
        query: {
            filter: {},
        },
    })

    assert.equal(res.data[0].name, "parenthi")
})
