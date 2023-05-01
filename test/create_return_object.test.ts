import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, run, models, lifecycle } from "../packages/core"
import { Store } from "../packages/database"
import { Model, Field } from "../packages/decorator"
import { Create, Read, Count, Delete, Test, Update } from "../packages/method"
import { Text, Array, Boolean, Buffer, Char, Function, Plain } from "../packages/type"
import { After, Before } from "../packages/mixin"

it("Create return type must be object", async function () {
    const SettingToCreate = await model({
        name: "SettingToCreate",
        database: Store,
        schema: {
            key: { type: Text, required: true },
            value: { type: Text, required: true },
        },
    })

    let res = await run({
        token: process.env.SYSTEM_TOKEN,
        model: SettingToCreate,
        method: Create,
        body: {
            key: "Test",
            value: "Test",
        },
    })
    assert.equal(lodash.has(res.data, "key"), true)
    assert.equal(lodash.has(res.data, "value"), true)
    assert.equal(lodash.has(res.data, "id"), true)
    assert.equal(typeof res.data, "object")
})
