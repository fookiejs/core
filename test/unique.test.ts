import { it, describe, assert } from "vitest"
import { model, run, models } from "../src"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create, Read } from "../src/methods"
import { Text } from "../src/types"
import * as lodash from "lodash"

it("Unique", async function () {
    const fookie = require("../src/index")
    await fookie.init()
    model({
        name: "number",
        database: Store,
        schema: {
            val: {
                type: "number",
                unique: true,
            },
        },
    })

    await run({
        token: process.env.SYSTEM_TOKEN,
        model: "number",
        method: "create",
        body: {
            val: 1,
        },
    })

    const res = await run({
        token: process.env.SYSTEM_TOKEN,
        model: "number",
        method: "create",
        body: {
            val: 1,
        },
    })

    assert.equal(res.status, false)
})
