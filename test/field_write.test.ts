import { it, describe, assert } from "vitest"
import { model, run, models } from "../src"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create, Read } from "../src/methods"
import { Text, Number } from "../src/types"
import * as lodash from "lodash"

it("read:['nobody'] -> empty field", async function () {
    let model_res = model({
        name: "child_setting",
        database: Store,
        schema: {
            msg: {
                type: Text,
                write: ["nobody"],
            },
        },
    })

    let create_res = await run({
        model: "child_setting",
        method: Create,
        body: {
            msg: "hola",
        },
    })

    assert.equal(create_res.status, false)
})
