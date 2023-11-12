import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import * as Fookie from "../index"

it("read:['nobody'] -> empty field", async function () {
    let test_field_read = await Fookie.Builder.model({
        name: "test_field_read",
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

    await Fookie.run({
        model: test_field_read,
        method: Fookie.Method.Create,
        body: {
            msg: "hi",
        },
    })

    let read_res = await Fookie.run({
        model: test_field_read,
        method: "read",
        query: {
            filter: {},
        },
    })

    assert.equal(read_res.data[0].msg, undefined)
})
