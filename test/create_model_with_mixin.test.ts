import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import * as Fookie from "../index"

it("Model with mixin", async function () {
    const mx = Fookie.Builder.mixin({
        schema: {
            mixin_field: {
                type: Fookie.Dictionary.Type.text,
            },
        },
    })

    const model_w_m = await Fookie.Builder.model({
        name: "model_w_m",
        database: Fookie.Dictionary.Database.store,
        mixins: [mx],
        schema: {
            field: {
                type: Fookie.Dictionary.Type.text,
            },
        },
    })

    const isObj = lodash.isObject(model_w_m.schema.mixin_field)
    assert.equal(isObj, true)
})
