import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, run, models, lifecycle } from "../packages/core"
import { Store, database } from "../packages/database"
import { Model, Field } from "../packages/decorator"
import { Create, Read, Count, Delete, Test, Update } from "../packages/method"
import { Text, Number, Array, Boolean, Buffer, Char, Function, Plain } from "../packages/type"
import { mixin, After, Before } from "../packages/mixin"

it("Reactives", async function () {
    const reactive_child = model({
        name: "reactive_child",
        database: Store,
        schema: {
            name: {
                type: Text,
                required: true,
            },
        },
    })

    const reactive_parent = model({
        name: "reactive_parent",
        database: Store,
        schema: {
            name: {
                type: Text,
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
    })

    const create_child_res = await run({
        model: reactive_child,
        method: Create,
        body: {
            name: "child",
        },
    })

    const create_parent_res = await run({
        model: reactive_parent,
        method: Create,
        body: {
            name: "parent",
            child: create_child_res.data.id,
        },
    })

    await run({
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
        model: "reactive_child",
        method: "read",
        query: {
            filter: {},
        },
    })
    assert.equal(res.data[0].name, "parenthi")
})
