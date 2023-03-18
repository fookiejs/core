import { it, describe, assert } from "vitest"
import { model, run, models } from "../src"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create, Read } from "../src/methods"
import { Text } from "../src/types"
import * as lodash from "lodash"

it("Create model", async function () {
    await fookie.init()
    let res = await run({
        token: process.env.SYSTEM_TOKEN,
        model: "setting",
        method: "create",
        body: {
            name: "Create model",
            value: { a: "yow yow" },
        },
    })
    assert.equal(res.status, true)
})
