import { it, describe, assert } from "vitest"
import { model, run, models } from "../src"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create, Read } from "../src/methods"
import { Text, Number } from "../src/types"
import * as lodash from "lodash"

it("Reactives", async function () {
    model({
        name: "reactive_parent",
        database: Store,
        schema: {
            name: {
                type: Text,
                required: true,
            },
            child: {
                relation: "reactive_child",
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

    model({
        name: "reactive_child",
        database: Store,
        schema: {
            name: {
                type: Text,
                required: true,
            },
        },
    })

    const create_child_res = await run({
        model: "reactive_child",
        method: Create,
        token: process.env.SYSTEM_TOKEN,
        body: {
            name: "child",
        },
    })

    const create_parent_res = await run({
        model: "reactive_parent",
        method: Create,
        token: process.env.SYSTEM_TOKEN,
        body: {
            name: "parent",
            child: create_child_res.data.id,
        },
    })

    await run({
        model: "reactive_parent",
        method: "update",
        token: process.env.SYSTEM_TOKEN,
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
        token: process.env.SYSTEM_TOKEN,
        query: {
            filter: {},
        },
    })
    assert.equal(res.data[0].name, "parenthi")
})
