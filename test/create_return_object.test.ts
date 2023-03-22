import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, run, models, lifecycle } from "../packages/core"
import { Store, database } from "../packages/database"
import { Model, Field } from "../packages/decorator"
import { Create, Read, Count, Delete, Test, Update } from "../packages/method"
import { Text, Number, Array, Boolean, Buffer, Char, Function, Plain } from "../packages/type"
import { mixin, After, Before } from "../packages/mixin"

it("Create return type must be object", async function () {
    @Model({ database: Store })
    class SettingToCreate {
        @Field({ type: Text, required: true })
        key: string
        @Field({ type: Text, required: true })
        value: string
    }

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
