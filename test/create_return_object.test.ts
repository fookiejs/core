import { it, describe, assert } from "vitest"
import { model, run, models } from "../src"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create, Read } from "../src/methods"
import { Text } from "../src/types"
import * as lodash from "lodash"

it("Create return type must be object", async function () {
    await fookie.init()
    let res = await run({
        token: process.env.SYSTEM_TOKEN,
        model: "setting",
        method: "create",
        body: {
            name: "notexistingname",
            value: { asd: "testany" },
        },
    })
    assert.equal(lodash.has(res.data, "name"), true)
    assert.equal(lodash.has(res.data, "value"), true)
    assert.equal(lodash.has(res.data, "id"), true)
    assert.equal(typeof res.data, "object")
})
