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
        name: "only_server",
        database: Store,
        schema: {
            val: {
                type: "number",
                onlyServer: true,
                default: -1,
            },
        },
    })

    const res = await run({
        token: "system_token",
        model: "only_server",
        method: "create",
        body: {
            val: 1,
        },
    })

    const res2 = await run({
        token: "system_token",
        model: "only_server",
        method: "create",
        body: {},
    })

    assert.equal(res.status, false)
    assert.equal(res2.status, true)
})
