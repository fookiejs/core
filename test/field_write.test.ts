import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, run, models, lifecycle } from "@fookie/core"
import { Store, database } from "@fookie/database"
import { Model, Field } from "@fookie/decorator"
import { Create, Read, Count, Delete, Test, Update } from "@fookie/method"
import { Text, Number, Array, Boolean, Buffer, Char, Function, Plain } from "@fookie/type"
import { mixin, After, Before } from "@fookie/mixin"
import { nobody, everybody, system } from "@fookie/role"

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
