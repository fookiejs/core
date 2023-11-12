import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, lifecycle, mixin } from "../packages/builder"
import { run } from "../packages/run"
import * as Database from "../packages/database"
import { Create, Read, Count, Delete, Test, Update } from "../packages/method"
import * as Type from "../packages/type"
import * as Mixin from "../packages/mixin"

it("Model required and crud operations", async function () {
    let need_crud_model = await model({
        name: "need_crud_model",
        database: Database.Store,
        schema: {
            msg: {
                type: Type.Text,
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
