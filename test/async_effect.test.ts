import { it, describe, assert } from "vitest"
import { model, run, models, lifecycle } from "../index"
import { Store } from "../packages/databases"
import { Model, Field } from "../packages/decorators"
import { Create, Read } from "../packages/methods"
import { Text, Number } from "../packages/types"
import * as lodash from "lodash"

it("async effect", async function () {
    let flag = false
    const ls = lifecycle(async function () {
        flag = true
    })

    model({
        name: "async_effect_model",
        database: Store,
        schema: {
            field: {
                type: Text,
            },
        },
        bind: {
            read: {
                effect: [ls],
            },
        },
    })

    await run({
        model: "async_effect_model",
        method: Read,
    })

    assert.equal(flag, true)
})
