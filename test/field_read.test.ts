import { it, describe, assert } from "vitest"
import { model, run, models } from "../src"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create, Read } from "../src/methods"
import { Text, Number } from "../src/types"
import { nobody } from "../src/roles"
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
