import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, run, models, lifecycle } from "../packages/core"
import { Store } from "../packages/database"
import { Model, Field } from "../packages/decorator"
import { Create, Read, Count, Delete, Test, Update } from "../packages/method"
import { Text, Array, Boolean, Buffer, Char, Function, Plain } from "../packages/type"

it("Attributes", async function () {
    const attributes_model = await model({
        name: "ClassModelAttributes",
        database: Store,
        schema: {
            field1: { type: Text, required: true },
            field2: { type: Text, required: true },
            field3: { type: Text, required: true },
            field4: { type: Text, required: true },
            field5: { type: Text, required: true },
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
        model: attributes_model,
        method: Create,
        body: {
            field1: "abc",
            field2: "abc",
            field3: "abc",
            field4: "abc",
            field5: "abc",
        },
    })

    const response = await run({
        model: attributes_model,
        method: Read,
        query: {
            attributes: ["field1", "field4"],
        },
    })

    assert.equal(response.status, true)

    assert.deepEqual(lodash.omit(response.data[0], ["field1", "field4", "id"]), {})
})
