import { it, describe, assert } from "vitest"
import { model, run, models } from "../src"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create, Read } from "../src/methods"
import { Text } from "../src/types"
import * as lodash from "lodash"

it("read:['nobody'] -> empty field", async function () {
    let model_res = model({
        name: "test_field_read",
        database: Store,
        schema: {
            msg: {
                type: Text,
                read: ["nobody"],
            },
        },
    })

    let create_res = await run({
        model: "test_field_read",
        method: "create",
        body: {
            msg: "hi",
        },
    })

    let read_res = await run({
        model: "test_field_read",
        method: "read",
        query: {
            filter: {},
            attributes: ["msg"],
        },
    })
    assert.equal(read_res.data[0].msg, undefined)
})
