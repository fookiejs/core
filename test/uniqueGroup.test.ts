import { it, describe, assert } from "vitest"
import { model, run, models } from "../src"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create, Read } from "../src/methods"
import { Text } from "../src/types"
import * as lodash from "lodash"

it("uniqueGroup", async function () {
    const fookie = require("../src/index")
    await fookie.init()
    model({
        name: "number",
        database: Store,
        schema: {
            val1: {
                type: "number",
                uniqueGroup: ["g1"],
            },
            val2: {
                type: "number",
                uniqueGroup: ["g1"],
            },
            val3: {
                type: "number",
                uniqueGroup: ["g1"],
            },
        },
    })

    await run({
        token: process.env.SYSTEM_TOKEN,
        model: "number",
        method: "create",
        body: {
            val1: 1,
            val2: 1,
            val3: 1,
        },
    })

    const res = await run({
        token: process.env.SYSTEM_TOKEN,
        model: "number",
        method: "create",
        body: {
            val1: 1,
            val2: 1,
            val3: 2,
        },
    })

    assert.equal(res.status, true)

    const res2 = await run({
        token: process.env.SYSTEM_TOKEN,
        model: "number",
        method: "create",
        body: {
            val1: 1,
            val2: 1,
            val3: 1,
        },
    })

    assert.equal(res2.status, false)
})
