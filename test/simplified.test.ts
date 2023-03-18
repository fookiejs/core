import { it, describe, assert } from "vitest"
import { model, run, models } from "../src"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create, Read } from "../src/methods"
import { Text } from "../src/types"
import * as lodash from "lodash"

it("Features Simplified", async function () {
    const res = await run({
        model: "model",
        method: "read",
        token: process.env.SYSTEM_TOKEN,
        options: {
            simplified: true,
        },
    })
    assert.equal(res.status, true)
})
