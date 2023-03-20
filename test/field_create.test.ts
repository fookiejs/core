import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, run, models, lifecycle } from "@fookie/core"
import { Store, database } from "@fookie/database"
import { Model, Field } from "@fookie/decorator"
import { Create, Read, Count, Delete, Test, Update } from "@fookie/method"
import { Text, Number, Array, Boolean, Buffer, Char, Function, Plain } from "@fookie/type"
import { mixin, After, Before } from "@fookie/mixin"
import { nobody, everybody, system } from "@fookie/role"

it("create:['nobody'] -> empty field", async function () {
    let model_res = model({
        name: "test_field_create",
        database: Store,
        schema: {
            msg: {
                type: Text,
                read: [nobody],
            },
        },
    })

    let create_res = await run({
        model: "test_field_create",
        method: Create,
        body: {
            msg: "hi",
        },
    })
    assert.equal(create_res.data.msg, undefined)
})
