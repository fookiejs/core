import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, run, models, lifecycle } from "../packages/core"
import { Store, database } from "../packages/database"
import { Model, Field } from "../packages/decorator"
import { Create, Read, Count, Delete, Test, Update } from "../packages/method"
import { Text, Number, Array, Boolean, Buffer, Char, Function, Plain } from "../packages/type"
import { mixin, After, Before } from "../packages/mixin"

it("Model required and crud operations", async function () {
    let need_crud_model = await model({
        name: "need_crud_model",
        database: Store,
        schema: {
            msg: {
                type: Text,
            },
        },
    })

    assert.equal(lodash.has(need_crud_model.methods, "create"), true)
    assert.equal(lodash.has(need_crud_model.methods, "read"), true)
    assert.equal(lodash.has(need_crud_model.methods, "count"), true)
    assert.equal(lodash.has(need_crud_model.methods, "test"), true)
    assert.equal(lodash.has(need_crud_model.methods, "update"), true)
    assert.equal(lodash.has(need_crud_model.methods, "delete"), true)
})
