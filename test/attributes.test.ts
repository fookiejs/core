import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import * as Fookie from "../index"

it("Attributes", async function () {
    const attributes_model = await Fookie.Builder.model({
        name: "ClassModelAttributes",
        database: Fookie.Dictionary.Database.store,
        schema: {
            field1: { type: Fookie.Dictionary.Type.text, required: true },
            field2: { type: Fookie.Dictionary.Type.text, required: true },
            field3: { type: Fookie.Dictionary.Type.text, required: true },
            field4: { type: Fookie.Dictionary.Type.text, required: true },
            field5: { type: Fookie.Dictionary.Type.text, required: true },
        },
        bind: {
            test: {},
            create: {},
            delete: {},
            read: {},
            count: {},
        },
    })

    await Fookie.run({
        model: attributes_model,
        method: Fookie.Method.Create,
        body: {
            field1: "abc",
            field2: "abc",
            field3: "abc",
            field4: "abc",
            field5: "abc",
        },
    })

    const response = await Fookie.run({
        model: attributes_model,
        method: Fookie.Method.Read,
        query: {
            attributes: ["field1", "field4"],
        },
    })

    assert.equal(response.status, true)

    assert.deepEqual(lodash.omit(response.data[0], ["field1", "field4", "id"]), {})
})
