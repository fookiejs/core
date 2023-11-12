import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, lifecycle, mixin } from "../packages/builder"
import { run } from "../packages/run"
import * as Database from "../packages/database"
import { Create, Read, Count, Delete, Test, Update } from "../packages/method"
import * as Type from "../packages/type"
import * as Mixin from "../packages/mixin"
import * as Lifecycle from "../packages/lifecycle"

it("read:['nobody'] -> empty field", async function () {
    let field_write_model = await model({
        name: "field_write_model",
        database: Database.Store,
        schema: {
            msg: {
                type: Type.Text,
                write: [Lifecycle.nobody],
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
