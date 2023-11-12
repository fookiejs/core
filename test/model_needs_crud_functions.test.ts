import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import * as Fookie from "../index"

it("Model required and crud operations", async function () {
    let need_crud_model = await Fookie.Builder.model({
        name: "need_crud_model",
        database: Fookie.Dictionary.Database.store,
        schema: {
            msg: {
                type: Fookie.Dictionary.Type.text,
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
