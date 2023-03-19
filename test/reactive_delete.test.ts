import { it, describe, assert } from "vitest"
import { model, run, models } from "../src"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create, Read } from "../src/methods"
import { Text, Number } from "../src/types"
import * as lodash from "lodash"

it("Reactive Delete", async function () {
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
                reactive_delete: true,
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

    console.log(create_parent_res)
    await run({
        model: reactive_parent,
        method: "delete",
        query: {
            filter: {},
        },
    })

    let res = await run({
        model: "reactive_child",
        method: "count",
        query: {
            filter: {},
        },
    })
    assert.equal(res.data, 0)
})
