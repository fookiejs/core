import { it, describe, assert } from "vitest"
import { model, run, models } from "../src"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create, Read, Count } from "../src/methods"
import { Text } from "../src/types"
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
