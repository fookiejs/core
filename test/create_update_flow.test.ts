import { it, describe, assert } from "vitest"
import { model, run, models } from "../src"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create, Read } from "../src/methods"
import { Text } from "../src/types"
import * as lodash from "lodash"

let example_model = {
    name: "test_model",
    database: Store,
    schema: {
        user: {
            relation: "user",
        },
    },
    lifecycle: {
        read: {},
        update: {},
        update: {},
        delete: {},
        model: {},
    },
    mixins: [],
}

it("Create and update model", async function () {
    let res = await run({
        token: process.env.SYSTEM_TOKEN,
        model: "model",
        method: "create",
        body: example_model,
    })
    assert.equal(res.data.name, example_model.name)
    assert.equal(res.status, true)

    res = await run({
        token: process.env.SYSTEM_TOKEN,
        model: "model",
        method: "update",
        query: {
            filter: { name: example_model.name },
        },
        body: {
            name: "test_model2",
        },
    })
    assert.equal(res.status, true)
})
