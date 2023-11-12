import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import * as Fookie from "../index"

it("Reactives", async function () {
    const reactive_child = await Fookie.Builder.model({
        name: "reactive_child",
        database: Fookie.Dictionary.Database.store,
        schema: {
            name: {
                type: Fookie.Dictionary.Type.text,
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

    const reactive_parent = await Fookie.Builder.model({
        name: "reactive_parent",
        database: Fookie.Dictionary.Database.store,
        schema: {
            name: {
                type: Fookie.Dictionary.Type.text,
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

    const create_child_res = await Fookie.run({
        token: process.env.SYSTEM_TOKEN,
        model: reactive_child,
        method: Fookie.Method.Create,
        body: {
            name: "child",
        },
    })

    const create_parent_res = await Fookie.run({
        token: process.env.SYSTEM_TOKEN,
        model: reactive_parent,
        method: Fookie.Method.Create,
        body: {
            name: "parent",
            child: create_child_res.data.id,
        },
    })

    await Fookie.run({
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

    let res = await Fookie.run({
        model: reactive_child,
        method: "read",
        query: {
            filter: {},
        },
    })

    assert.equal(res.data[0].name, "parenthi")
})
