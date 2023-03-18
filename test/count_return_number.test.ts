import { it, describe, assert } from "vitest"
import { model, run, models } from "../src"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create, Read } from "../src/methods"
import { Text } from "../src/types"
import * as lodash from "lodash"

it("Count return value must be number", async function () {
    await fookie.init()
    let res = await run({
        token: process.env.SYSTEM_TOKEN,
        model: "model",
        method: "count",
    })
    assert.equal(typeof res.data, "number")
})
