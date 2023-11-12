import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import * as Fookie from "../index"

it("Create return type must be object", async function () {
    const SettingToCreate = await Fookie.Builder.model({
        name: "SettingToCreate",
        database: Fookie.Dictionary.Database.store,
        schema: {
            key: { type: Fookie.Dictionary.Type.text, required: true },
            value: { type: Fookie.Dictionary.Type.text, required: true },
        },
    })

    let res = await Fookie.run({
        token: process.env.SYSTEM_TOKEN,
        model: SettingToCreate,
        method: Fookie.Method.Create,
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
