import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, lifecycle, mixin } from "../packages/builder"
import { run } from "../packages/run"
import * as Database from "../packages/database"
import { Create, Read, Count, Delete, Test, Update } from "../packages/method"
import * as Type from "../packages/type"
import * as Mixin from "../packages/mixin"
import * as Role from "../packages/role"

it("Create return type must be object", async function () {
    const SettingToCreate = await model({
        name: "SettingToCreate",
        database: Database.Store,
        schema: {
            key: { type: Type.Text, required: true },
            value: { type: Type.Text, required: true },
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
