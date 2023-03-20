import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, run, models, lifecycle } from "@fookie/core"
import { Store, database } from "@fookie/database"
import { Model, Field } from "@fookie/decorator"
import { Create, Read, Count, Delete, Test, Update } from "@fookie/method"
import { Text, Number, Array, Boolean, Buffer, Char, Function, Plain } from "@fookie/type"
import { mixin, After, Before } from "@fookie/mixin"

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
