import { it, describe, assert } from "vitest"
import { model, run, models } from "../src"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create, Read } from "../src/methods"
import { Text } from "../src/types"
import * as lodash from "lodash"

it("in mixin use exist", async function () {
    await init
    let res1 = await run({
        token: "system_token",
        model: "mixin",
        method: "delete",
        query: {
            filter: {
                name: "before",
            },
        },
    })

    assert.equal(res1.status, false)
    assert.equal(res1.error, "in_mixin_use")
})

it("in mixin use not exist", async function () {
    await init
    let res2 = await run({
        token: "system_token",
        model: "mixin",
        method: "delete",
        query: {
            filter: {
                name: "not_exist_mixin",
            },
        },
    })

    assert.equal(res2.status, true)
})
