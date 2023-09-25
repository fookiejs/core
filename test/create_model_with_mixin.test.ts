import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, lifecycle, mixin } from "../packages/builder"
import { run } from "../packages/run"
import * as Database from "../packages/database"
import { Create, Read, Count, Delete, Test, Update } from "../packages/method"
import * as Type from "../packages/type"
import * as Mixin from "../packages/mixin"
import * as Role from "../packages/role"

it("Model with mixin", async function () {
    const mx = mixin({
        schema: {
            mixin_field: {
                type: Type.Text,
            },
        },
    })

    const model_w_m = await model({
        name: "model_w_m",
        database: Database.Store,
        mixins: [mx],
        schema: {
            field: {
                type: Type.Text,
            },
        },
    })

    const isObj = lodash.isObject(model_w_m.schema.mixin_field)
    assert.equal(isObj, true)
})
