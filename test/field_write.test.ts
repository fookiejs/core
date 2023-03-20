import { it, describe, assert } from "vitest"
import { model, run, models } from "../index"
import { Store } from "../packages/databases"
import { Model, Field } from "../packages/decorators"
import { Create, Read } from "../packages/methods"
import { Text, Number } from "../packages/types"
import * as lodash from "lodash"
import { nobody } from "../packages/roles"

it("read:['nobody'] -> empty field", async function () {
    let field_write_model = model({
        name: "field_write_model",
        database: Store,
        schema: {
            msg: {
                type: Text,
                write: [nobody],
            },
        },
    })

    let create_res = await run({
        model: field_write_model,
        method: Create,
        body: {
            msg: "hola",
        },
    })

    assert.equal(create_res.status, false)
})
