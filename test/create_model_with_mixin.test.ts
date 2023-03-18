import { it, describe, assert } from "vitest"
import { model, run, models, mixin } from "../src"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create, Read } from "../src/methods"
import { Text, Number } from "../src/types"
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
