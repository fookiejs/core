import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import * as Fookie from "../index"

it("read:['nobody'] -> empty field", async function () {
    let field_write_model = await Fookie.Builder.model({
        name: "field_write_model",
        database: Fookie.Dictionary.Database.store,
        schema: {
            msg: {
                type: Fookie.Dictionary.Type.text,
                write: [Fookie.Dictionary.Lifecycle.nobody],
            },
        },
    })

    let create_res = await Fookie.run({
        model: field_write_model,
        method: Fookie.Method.Create,
        body: {
            msg: "hola",
        },
    })

    assert.equal(create_res.status, false)
})
