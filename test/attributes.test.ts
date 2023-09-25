import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, lifecycle, mixin } from "../packages/builder"
import { run } from "../packages/run"
import * as Database from "../packages/database"
import { Create, Read, Count, Delete, Test, Update } from "../packages/method"
import * as Type from "../packages/type"
import * as Mixin from "../packages/mixin"
import * as Role from "../packages/role"

it("Attributes", async function () {
    const attributes_model = await model({
        name: "ClassModelAttributes",
        database: Database.Store,
        schema: {
            field1: { type: Type.Text, required: true },
            field2: { type: Type.Text, required: true },
            field3: { type: Type.Text, required: true },
            field4: { type: Type.Text, required: true },
            field5: { type: Type.Text, required: true },
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
