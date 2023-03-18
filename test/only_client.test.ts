import { it, describe, assert } from "vitest"
import { model, run, models } from "../src"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create, Read } from "../src/methods"
import { Text } from "../src/types"
import * as lodash from "lodash"

it("Unique", async function () {
    const fookie = require("../src/index")

    model({
        name: "only_client",
        database: Store,
        schema: {
            val: {
                type: "number",
                onlyClient: true,
            },
        },
    })

    const res = await run({
        token: process.env.SYSTEM_TOKEN,
        model: "only_client",
        method: "create",
        body: {
            val: 1,
        },
    })

    const res2 = await run({
        token: process.env.SYSTEM_TOKEN,
        model: "only_client",
        method: "create",
        body: {},
    })

    assert.equal(res.status, true)
    assert.equal(res2.status, false)
})
