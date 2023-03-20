import { it, describe, assert } from "vitest"
import { model, run, models, mixin } from "../index"
import { Store } from "../packages/databases"
import { Model, Field } from "../packages/decorators"
import { Create, Read } from "../packages/methods"
import { Text, Number } from "../packages/types"
import * as lodash from "lodash"

it("Model with mixin", async function () {
    const mx = mixin({
        schema: {
            mixin_field: {
                type: Text,
            },
        },
    })

    const model_w_m = model({
        name: "model_w_m",
        database: Store,
        mixins: [mx],
        schema: {
            field: {
                type: Text,
            },
        },
    })

    const isObj = lodash.isObject(model_w_m.schema.mixin_field)
    assert.equal(isObj, true)
})
