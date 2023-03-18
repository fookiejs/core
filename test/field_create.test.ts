import { it, describe, assert } from "vitest"
import { model, run, models } from "../src"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create, Read } from "../src/methods"
import { Text } from "../src/types"
import * as lodash from "lodash"

it("create:['nobody'] -> empty field", async function () {
    let model_res = model({
        name: "test_field_create",
        database: Store,
        schema: {
            msg: {
                type: Text,
                read: ["nobody"],
            },
        },
    })

    let create_res = await run({
        model: "test_field_create",
        method: "create",
        body: {
            msg: "hi",
        },
    })
    assert.equal(create_res.data.msg, undefined)
})
