import { it, describe, assert } from "vitest"
import { model, run, models } from "../src"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create, Read } from "../src/methods"
import { Text } from "../src/types"
import * as lodash from "lodash"

it("Features Simplified", async function () {
    await fookie.init()
    const res = await run({
        model: "model",
        method: "read",
        token: "system_token",
        options: {
            simplified: true,
        },
    })
    assert.equal(res.status, true)
})
