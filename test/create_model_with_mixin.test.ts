import { it, describe, assert } from "vitest"
import { model, run, models } from "../src"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create, Read } from "../src/methods"
import { Text } from "../src/types"
import * as lodash from "lodash"

it("mixin model", async function () {
    await mixin({
        name: "mixin1",
        object: {
            schema: {
                mixin_field: {
                    type: Text,
                },
            },
        },
    })

    const res = await run({
        token: process.env.SYSTEM_TOKEN,
        model: "model",
        method: "create",
        body: {
            name: "model_w_m",
            database: Store,
            mixins: ["mixin1"],
            schema: {
                fieid: {
                    type: Text,
                },
            },
        },
    })

    const isObj = lodash.isObject(res.data.schema.mixin_field)
    assert.equal(isObj, true)
})
