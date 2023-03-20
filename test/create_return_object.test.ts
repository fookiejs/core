import { it, describe, assert } from "vitest"
import { model, run, models } from "../index"
import { Store } from "../packages/databases"
import { Model, Field } from "../packages/decorators"
import { Create, Read } from "../packages/methods"
import { Text, Number } from "../packages/types"
import * as lodash from "lodash"

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
