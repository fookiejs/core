import { it, describe, assert } from "vitest"
import { model, run, models } from "../src"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create, Read } from "../src/methods"
import { Text, Number } from "../src/types"
import * as lodash from "lodash"
import { nobody } from "../src/roles"

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
