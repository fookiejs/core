import { it, describe, assert } from "vitest"
import { model, run, models, lifecycle } from "../src"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create, Read } from "../src/methods"
import { Text } from "../src/types"
import * as lodash from "lodash"

it("async effect", async function () {
    let flag = false
    const ls = lifecycle(async function () {
        flag = true
    })

    await model({
        name: "async_effect_model",
        database: Store,
        schema: {
            fieid: {
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
        method: "read",
    })
    assert.equal(flag, true)
})
