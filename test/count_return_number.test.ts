import { it, describe, assert } from "vitest"
import { model, run, models } from "../index"
import { Store } from "../packages/databases"
import { Model, Field } from "../packages/decorators"
import { Create, Read, Count } from "../packages/methods"
import { Text, Number } from "../packages/types"
import * as lodash from "lodash"

it("Count return value must be number", async function () {
    @Model({ database: Store })
    class ModelToCount {
        @Field({ type: Text, required: true })
        name: string

        @Field({ type: Text, required: true })
        password: string
    }

    let res = await run({
        token: process.env.SYSTEM_TOKEN,
        model: ModelToCount,
        method: Count,
    })
    assert.equal(typeof res.data, "number")
})
