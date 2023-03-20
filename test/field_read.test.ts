import { it, describe, assert } from "vitest"
import { model, run, models } from "../index"
import { Store } from "../packages/databases"
import { Model, Field } from "../packages/decorators"
import { Create, Read } from "../packages/methods"
import { Text, Number } from "../packages/types"
import { nobody } from "../packages/roles"
import * as lodash from "lodash"

it("read:['nobody'] -> empty field", async function () {
    let model_res = model({
        name: "test_field_read",
        database: Store,
        schema: {
            msg: {
                type: Text,
                read: [nobody],
            },
        },
    })

    await run({
        model: "test_field_read",
        method: Create,
        body: {
            msg: "hi",
        },
    })

    let read_res = await run({
        model: "test_field_read",
        method: "read",
        query: {
            filter: {},
        },
    })

    assert.equal(read_res.data[0].msg, undefined)
})
