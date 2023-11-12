import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import * as Fookie from "../index"

it("create:['nobody'] -> empty field", async function () {
    let test_field_create = await Fookie.Builder.model({
        name: "test_field_create",
        database: Fookie.Dictionary.Database.store,
        schema: {
            msg: {
                type: Fookie.Dictionary.Type.text,
                read: [Fookie.Dictionary.Lifecycle.nobody],
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

    let create_res = await Fookie.run({
        model: test_field_create,
        method: Fookie.Method.Create,
        body: {
            msg: "hi",
        },
    })
    assert.equal(create_res.data.msg, undefined)
})
